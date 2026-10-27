import asyncio
import json
import os
import secrets
import time
import uuid
from typing import Annotated
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
load_dotenv()
app = FastAPI(title="Financial Coach", version="0.1.0")
Money = Annotated[float, Field(ge=0, le=1e10, allow_inf_nan=False)]
class DebtInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: Money
    interest_rate: float = Field(ge=0, le=100, allow_inf_nan=False)
    min_payment: Money = 0
class Profile(BaseModel):
    monthly_income: Money
    dependants: int = Field(ge=0, le=50)
    manual_expenses: dict[str, Money] = Field(max_length=30)
    debts: list[DebtInput] = Field(default_factory=list, max_length=10)
@app.get("/health")
def health():
    return {"status": "ok", "mode": os.getenv("COACH_MODE", "demo")}
@app.post("/analyze")
async def analyze(profile: Profile, authorization: str = Header(default="")):
    token = os.getenv("COACH_API_TOKEN")
    if token and not secrets.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(401, "Unauthorized")
    if os.getenv("K_SERVICE") and not token:
        raise HTTPException(503, "Configure COACH_API_TOKEN before cloud use")
    payload = profile.model_dump()
    expenses = round(sum(profile.manual_expenses.values()), 2)
    summary = {"income": profile.monthly_income, "expenses": expenses,
               "remaining": round(profile.monthly_income - expenses, 2),
               "debt": sum(d.amount for d in profile.debts)}
    if os.getenv("COACH_MODE", "demo") == "demo":
        return {"mode": "demo", "summary": summary, "trace": [], "results": {
            "budget_analysis": {"note": "Demo calculation only. Connect Vertex AI for personalized analysis.", "spending_categories": [{"category": k, "amount": v} for k,v in profile.manual_expenses.items()]},
            "savings_strategy": {"note": "A six-month expense illustration; not an AI recommendation.", "illustrative_emergency_fund": expenses * 6},
            "debt_reduction": {"note": "Live analysis compares avalanche and snowball strategies. No payoff forecast is fabricated in demo mode.", "total_debt": summary["debt"]}
        }}
    if os.getenv("COACH_MODE") != "live":
        raise HTTPException(503, "COACH_MODE must be demo or live")
    from agents import FinanceAdvisorSystem, APP_NAME, BudgetAnalysis, SavingsStrategy, DebtReduction
    from google.genai import types
    system = FinanceAdvisorSystem()
    sid = uuid.uuid4().hex
    uid = uuid.uuid4().hex
    trace = []
    started = time.monotonic()
    await system.session_service.create_session(app_name=APP_NAME, user_id=uid, session_id=sid, state=payload)
    try:
        async with asyncio.timeout(180):
            async for event in system.runner.run_async(user_id=uid, session_id=sid, new_message=types.Content(role="user", parts=[types.Part(text=json.dumps(payload))])):
                if event.is_final_response():
                    trace.append({"agent": event.author, "elapsed_seconds": round(time.monotonic()-started, 2)})
            session = await system.session_service.get_session(app_name=APP_NAME, user_id=uid, session_id=sid)
            result = {}
            for key, schema in [("budget_analysis", BudgetAnalysis), ("savings_strategy", SavingsStrategy), ("debt_reduction", DebtReduction)]:
                value = session.state[key]
                result[key] = (schema.model_validate_json(value) if isinstance(value, str) else schema.model_validate(value)).model_dump()
            return {"mode": "live", "summary": summary, "trace": trace, "results": result}
    except TimeoutError:
        raise HTTPException(504, "Analysis timed out. Please retry.")
    except Exception:
        raise HTTPException(502, "Agent analysis failed. Check model access and cloud configuration.")
    finally:
        await system.session_service.delete_session(app_name=APP_NAME, user_id=uid, session_id=sid)
