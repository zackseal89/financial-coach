import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

class CoachTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"COACH_MODE":"demo","COACH_API_TOKEN":"","K_SERVICE":""})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = TestClient(app)
        self.profile = {"monthly_income":85000,"dependants":0,"manual_expenses":{"Housing":25000,"Food":18000},"debts":[]}
    def test_demo_calculates_without_ai_forecasts(self):
        response = self.client.post("/analyze", json=self.profile)
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(data["mode"],"demo")
        self.assertEqual(data["summary"]["remaining"],42000)
        self.assertEqual(data["trace"],[])
        self.assertNotIn("payoff_plans",data["results"]["debt_reduction"])
    def test_demo_analysis_stream_returns_a_final_result_event(self):
        response = self.client.post("/analyze/stream", json=self.profile)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        events = [line[6:] for line in response.text.splitlines() if line.startswith("data: ")]
        self.assertEqual(len(events), 1)
        event = __import__("json").loads(events[0])
        self.assertEqual(event["type"], "result")
        self.assertEqual(event["result"]["summary"]["remaining"], 42000)

    def test_live_analysis_stream_emits_each_agent_transition_in_order(self):
        import sys
        from types import ModuleType, SimpleNamespace

        stages = ["BudgetAnalysisAgent", "SavingsStrategyAgent", "DebtReductionAgent"]

        class FakeEvent:
            def __init__(self, author):
                self.author = author

            def is_final_response(self):
                return True

        class FakeSessionService:
            async def create_session(self, **kwargs):
                return None

            async def get_session(self, **kwargs):
                return SimpleNamespace(state={
                    "budget_analysis": {"ok": "budget"},
                    "savings_strategy": {"ok": "savings"},
                    "debt_reduction": {"ok": "debt"},
                })

            async def delete_session(self, **kwargs):
                return None

        class FakeSchema:
            @classmethod
            def model_validate(cls, value):
                return SimpleNamespace(model_dump=lambda: value)

        class FakeAgent:
            def __init__(self, name):
                self.name = name
                self.before_agent_callback = None

        class FakeSystem:
            def __init__(self):
                self.session_service = FakeSessionService()
                self.coordinator_agent = SimpleNamespace(
                    sub_agents=[FakeAgent(stage) for stage in stages]
                )
                self.runner = SimpleNamespace(run_async=self.run_async)

            async def run_async(self, **kwargs):
                for agent in self.coordinator_agent.sub_agents:
                    await agent.before_agent_callback(None)
                    yield FakeEvent(agent.name)

        fake_agents = ModuleType("agents")
        fake_agents.FinanceAdvisorSystem = FakeSystem
        fake_agents.APP_NAME = "test"
        fake_agents.BudgetAnalysis = FakeSchema
        fake_agents.SavingsStrategy = FakeSchema
        fake_agents.DebtReduction = FakeSchema

        with patch.dict(os.environ, {"COACH_MODE": "live", "COACH_API_TOKEN": "", "K_SERVICE": ""}):
            with patch.dict(sys.modules, {"agents": fake_agents}):
                response = self.client.post("/analyze/stream", json=self.profile)

        self.assertEqual(response.status_code, 200)
        events = [
            __import__("json").loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        progress = [(event["agent"], event["status"]) for event in events if event["type"] == "progress"]
        self.assertEqual(progress, [(stage, status) for stage in stages for status in ("working", "done")])
        self.assertEqual(events[-1]["type"], "result")
        self.assertEqual(len(events[-1]["result"]["trace"]), 3)

    def test_negative_income_rejected(self):
        self.profile["monthly_income"]=-1
        self.assertEqual(self.client.post("/analyze",json=self.profile).status_code,422)
    def test_debt_rate_rejected(self):
        self.profile["debts"]=[{"name":"Card","amount":100,"interest_rate":101,"min_payment":10}]
        self.assertEqual(self.client.post("/analyze",json=self.profile).status_code,422)
    def test_token_required_when_configured(self):
        with patch.dict(os.environ,{"COACH_API_TOKEN":"test-only-token"}):
            self.assertEqual(self.client.post("/analyze",json=self.profile).status_code,401)
            self.assertEqual(self.client.post("/analyze",json=self.profile,headers={"Authorization":"Bearer test-only-token"}).status_code,200)
    def test_cloud_requires_token(self):
        with patch.dict(os.environ,{"K_SERVICE":"test-service"}):
            self.assertEqual(self.client.post("/analyze",json=self.profile).status_code,503)
    def test_deficit_and_zero_income(self):
        self.profile["monthly_income"]=0
        self.assertEqual(self.client.post("/analyze",json=self.profile).json()["summary"]["remaining"],-43000)
    def test_demo_chat_discloses_that_ai_is_not_connected(self):
        response = self.client.post("/chat", json={"message":"How much is left?","profile":self.profile})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mode"], "demo")
        self.assertIn("AI chat is not connected", data["reply"])
        self.assertIn("KES 42,000", data["reply"])
        self.assertEqual(data["trace"], [])
    def test_chat_rejects_oversized_history(self):
        body = {"message":"Help","profile":self.profile,"history":[{"role":"user","content":"Hi"}] * 11}
        self.assertEqual(self.client.post("/chat", json=body).status_code, 422)
    def test_chat_requires_token_when_configured(self):
        body = {"message":"Help","profile":self.profile}
        with patch.dict(os.environ,{"COACH_API_TOKEN":"test-only-token"}):
            self.assertEqual(self.client.post("/chat",json=body).status_code,401)
            response = self.client.post("/chat",json=body,headers={"X-Coach-Token":"test-only-token"})
            self.assertEqual(response.status_code,200)
    def test_agent_dependency_order(self):
        from agents import FinanceAdvisorSystem
        system=FinanceAdvisorSystem()
        self.assertEqual([a.name for a in system.coordinator_agent.sub_agents],["BudgetAnalysisAgent","SavingsStrategyAgent","DebtReductionAgent"])
        self.assertIn("{budget_analysis}",system.savings_strategy_agent.instruction)
        self.assertIn("{savings_strategy}",system.debt_reduction_agent.instruction)
if __name__=="__main__":
    unittest.main()

