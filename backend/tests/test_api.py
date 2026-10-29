import json
import os
import sys
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app


STAGES = ["BudgetAnalysisAgent", "SavingsStrategyAgent", "DebtReductionAgent"]


def _build_fake_agents_module(
    state_override=None,
    chat_reply="Habari! After KES 43,000 in expenses, you have KES 42,000 remaining.",
    fail_run=False,
):
    state = state_override or {
        "budget_analysis": {
            "total_expenses": 43000.0,
            "monthly_income": 85000.0,
            "spending_categories": [
                {"category": "Housing", "amount": 25000.0, "percentage": 58.14},
                {"category": "Food", "amount": 18000.0, "percentage": 41.86},
            ],
            "recommendations": [
                {
                    "category": "Food",
                    "recommendation": "Buy dry staples in bulk.",
                    "potential_savings": 2500.0,
                }
            ],
        },
        "savings_strategy": {
            "emergency_fund": {
                "recommended_amount": 258000.0,
                "current_amount": 0.0,
                "current_status": "Start building a 6-month reserve.",
            },
            "recommendations": [
                {
                    "category": "Emergency Fund",
                    "amount": 15000.0,
                    "rationale": "Build 6 months of core expenses.",
                }
            ],
            "automation_techniques": [
                {
                    "name": "Standing Order",
                    "description": "Automate transfer on payday.",
                }
            ],
        },
        "debt_reduction": {
            "total_debt": 0.0,
            "debts": [],
            "payoff_plans": {
                "avalanche": {"total_interest": 0.0, "months_to_payoff": 0, "monthly_payment": 0.0},
                "snowball": {"total_interest": 0.0, "months_to_payoff": 0, "monthly_payment": 0.0},
            },
            "recommendations": [],
        },
    }

    class FakeEvent:
        def __init__(self, author, text=None):
            self.author = author
            self.content = (
                SimpleNamespace(parts=[SimpleNamespace(text=text)])
                if text is not None
                else None
            )

        def is_final_response(self):
            return True

    class FakeSessionService:
        async def create_session(self, **kwargs):
            return None

        async def get_session(self, **kwargs):
            return SimpleNamespace(state=state)

        async def delete_session(self, **kwargs):
            return None

    class FakeSchema:
        @classmethod
        def model_validate(cls, value):
            return SimpleNamespace(model_dump=lambda: value)

        @classmethod
        def model_validate_json(cls, value):
            return SimpleNamespace(model_dump=lambda: json.loads(value))

    class FakeAgent:
        def __init__(self, name):
            self.name = name
            self.before_agent_callback = None

    class FakeSystem:
        def __init__(self):
            self.session_service = FakeSessionService()
            self.coordinator_agent = SimpleNamespace(
                sub_agents=[FakeAgent(stage) for stage in STAGES]
            )
            self.runner = SimpleNamespace(run_async=self.run_async)

        async def run_async(self, **kwargs):
            if fail_run:
                raise RuntimeError("Vertex AI unavailable")
            for agent in self.coordinator_agent.sub_agents:
                if agent.before_agent_callback is not None:
                    await agent.before_agent_callback(None)
                yield FakeEvent(agent.name)

    class FakeChatRunner:
        def __init__(self, agent, app_name, session_service):
            self.agent = agent
            self.app_name = app_name
            self.session_service = session_service

        async def run_async(self, **kwargs):
            if fail_run:
                raise RuntimeError("Vertex AI unavailable")
            yield FakeEvent("FinancialCoachChatAgent", text=chat_reply)

    fake_agents = ModuleType("agents")
    fake_agents.FinanceAdvisorSystem = FakeSystem
    fake_agents.APP_NAME = "test"
    fake_agents.BudgetAnalysis = FakeSchema
    fake_agents.SavingsStrategy = FakeSchema
    fake_agents.DebtReduction = FakeSchema
    fake_agents.create_chat_agent = lambda: SimpleNamespace(name="FinancialCoachChatAgent")
    return fake_agents, FakeChatRunner, FakeSessionService


class CoachTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"COACH_API_TOKEN": "", "K_SERVICE": ""})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = TestClient(app)
        self.profile = {
            "monthly_income": 85000,
            "dependants": 0,
            "manual_expenses": {"Housing": 25000, "Food": 18000},
            "debts": [],
        }

    def test_analyze_runs_live_adk_pipeline(self):
        fake_agents, _, _ = _build_fake_agents_module()
        with patch.dict(sys.modules, {"agents": fake_agents}):
            response = self.client.post("/analyze", json=self.profile)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mode"], "live")
        self.assertEqual(data["summary"]["remaining"], 42000)
        self.assertEqual(len(data["trace"]), 3)
        self.assertIn("budget_analysis", data["results"])
        self.assertIn("savings_strategy", data["results"])
        self.assertIn("debt_reduction", data["results"])

    def test_live_analysis_stream_emits_each_agent_transition_in_order(self):
        fake_agents, _, _ = _build_fake_agents_module()
        with patch.dict(sys.modules, {"agents": fake_agents}):
            response = self.client.post("/analyze/stream", json=self.profile)

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        events = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        progress = [
            (event["agent"], event["status"])
            for event in events
            if event["type"] == "progress"
        ]
        self.assertEqual(
            progress,
            [(stage, status) for stage in STAGES for status in ("working", "done")],
        )
        self.assertEqual(events[-1]["type"], "result")
        self.assertEqual(events[-1]["result"]["mode"], "live")
        self.assertEqual(events[-1]["result"]["summary"]["remaining"], 42000)
        self.assertEqual(len(events[-1]["result"]["trace"]), 3)

    def test_analyze_failure_returns_explicit_502_without_demo_fallback(self):
        fake_agents, _, _ = _build_fake_agents_module(fail_run=True)
        with patch.dict(sys.modules, {"agents": fake_agents}):
            response = self.client.post("/analyze", json=self.profile)
        self.assertEqual(response.status_code, 502)

    def test_negative_income_rejected(self):
        self.profile["monthly_income"] = -1
        self.assertEqual(self.client.post("/analyze", json=self.profile).status_code, 422)

    def test_debt_rate_rejected(self):
        self.profile["debts"] = [
            {"name": "Card", "amount": 100, "interest_rate": 101, "min_payment": 10}
        ]
        self.assertEqual(self.client.post("/analyze", json=self.profile).status_code, 422)

    def test_token_required_when_configured(self):
        fake_agents, _, _ = _build_fake_agents_module()
        with patch.dict(os.environ, {"COACH_API_TOKEN": "test-only-token"}):
            with patch.dict(sys.modules, {"agents": fake_agents}):
                self.assertEqual(
                    self.client.post("/analyze", json=self.profile).status_code, 401
                )
                self.assertEqual(
                    self.client.post(
                        "/analyze",
                        json=self.profile,
                        headers={"Authorization": "Bearer test-only-token"},
                    ).status_code,
                    200,
                )

    def test_cloud_requires_token(self):
        with patch.dict(os.environ, {"K_SERVICE": "test-service"}):
            self.assertEqual(self.client.post("/analyze", json=self.profile).status_code, 503)

    def test_deficit_and_zero_income(self):
        fake_agents, _, _ = _build_fake_agents_module()
        self.profile["monthly_income"] = 0
        with patch.dict(sys.modules, {"agents": fake_agents}):
            self.assertEqual(
                self.client.post("/analyze", json=self.profile).json()["summary"]["remaining"],
                -43000,
            )

    def test_live_chat_returns_agent_reply(self):
        fake_agents, FakeChatRunner, FakeSessionService = _build_fake_agents_module()
        with patch.dict(sys.modules, {"agents": fake_agents}):
            with patch("google.adk.runners.Runner", FakeChatRunner):
                with patch("google.adk.sessions.InMemorySessionService", FakeSessionService):
                    response = self.client.post(
                        "/chat",
                        json={"message": "How much is left?", "profile": self.profile},
                    )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mode"], "live")
        self.assertIn("KES 42,000", data["reply"])
        self.assertEqual(len(data["trace"]), 1)

    def test_chat_rejects_oversized_history(self):
        body = {
            "message": "Help",
            "profile": self.profile,
            "history": [{"role": "user", "content": "Hi"}] * 11,
        }
        self.assertEqual(self.client.post("/chat", json=body).status_code, 422)

    def test_chat_requires_token_when_configured(self):
        fake_agents, FakeChatRunner, FakeSessionService = _build_fake_agents_module()
        body = {"message": "Help", "profile": self.profile}
        with patch.dict(os.environ, {"COACH_API_TOKEN": "test-only-token"}):
            with patch.dict(sys.modules, {"agents": fake_agents}):
                with patch("google.adk.runners.Runner", FakeChatRunner):
                    with patch("google.adk.sessions.InMemorySessionService", FakeSessionService):
                        self.assertEqual(self.client.post("/chat", json=body).status_code, 401)
                        response = self.client.post(
                            "/chat",
                            json=body,
                            headers={"X-Coach-Token": "test-only-token"},
                        )
                        self.assertEqual(response.status_code, 200)

    def test_agent_dependency_order(self):
        from agents import FinanceAdvisorSystem

        system = FinanceAdvisorSystem()
        self.assertEqual(
            [a.name for a in system.coordinator_agent.sub_agents],
            ["BudgetAnalysisAgent", "SavingsStrategyAgent", "DebtReductionAgent"],
        )
        self.assertIn("{budget_analysis}", system.savings_strategy_agent.instruction)
        self.assertIn("{savings_strategy}", system.debt_reduction_agent.instruction)


if __name__ == "__main__":
    unittest.main()
