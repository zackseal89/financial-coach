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

