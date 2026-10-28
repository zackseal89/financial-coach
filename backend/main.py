import asyncio
import json
import os
import secrets
import time
import uuid
from typing import Annotated, Literal
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

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    history: list[ChatTurn] = Field(default_factory=list, max_length=10)
    profile: Profile
    analysis_context: str = Field(default="", max_length=12000)

def _authorize(authorization: str, coach_token: str) -> None:
    token = os.getenv("COACH_API_TOKEN")
    authorized = secrets.compare_digest(authorization, f"Bearer {token}") or secrets.compare_digest(coach_token, token)
    if token and not authorized:
        raise HTTPException(401, "Unauthorized")
    if os.getenv("K_SERVICE") and not token:
        raise HTTPException(503, "Configure COACH_API_TOKEN before cloud use")

@app.get("/health")
def health():
    return {"status": "ok", "mode": os.getenv("COACH_MODE", "demo")}
@app.post("/analyze")
async def analyze(
    profile: Profile,
    authorization: str = Header(default=""),
    coach_token: str = Header(default="", alias="X-Coach-Token"),
):
    _authorize(authorization, coach_token)
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

@app.post("/chat")
async def chat(
    request: ChatRequest,
    authorization: str = Header(default=""),
    coach_token: str = Header(default="", alias="X-Coach-Token"),
):
    _authorize(authorization, coach_token)
    if not request.message.strip():
        raise HTTPException(422, "Enter a message for your coach")

    if os.getenv("COACH_MODE", "demo") == "demo":
        expenses = round(sum(request.profile.manual_expenses.values()), 2)
        remaining = round(request.profile.monthly_income - expenses, 2)
        reply = (
            "Demo mode — AI chat is not connected yet. From the numbers currently entered, "
            f"your listed income is KES {request.profile.monthly_income:,.0f} and your expenses total "
            f"KES {expenses:,.0f}, leaving KES {remaining:,.0f} before savings and debt payments. "
            "Set COACH_MODE=live and connect Vertex AI to chat with the Google ADK coach."
        )
        return {"mode": "demo", "reply": reply, "trace": []}
    if os.getenv("COACH_MODE") != "live":
        raise HTTPException(503, "COACH_MODE must be demo or live")

    from agents import APP_NAME, create_chat_agent
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    session_service = InMemorySessionService()
    runner = Runner(agent=create_chat_agent(), app_name=APP_NAME, session_service=session_service)
    sid, uid = uuid.uuid4().hex, uuid.uuid4().hex
    await session_service.create_session(app_name=APP_NAME, user_id=uid, session_id=sid)
    payload = {
        "financial_profile": request.profile.model_dump(),
        "prior_coaching_plan": request.analysis_context,
        "recent_conversation": [turn.model_dump() for turn in request.history[-10:]],
        "current_question": request.message,
    }
    started = time.monotonic()
    trace = []
    try:
        async with asyncio.timeout(70):
            async for event in runner.run_async(
                user_id=uid,
                session_id=sid,
                new_message=types.Content(role="user", parts=[types.Part(text=json.dumps(payload))]),
            ):
                if event.is_final_response() and event.content:
                    reply = "\n".join(
                        part.text for part in event.content.parts if getattr(part, "text", None)
                    ).strip()
                    if reply:
                        trace.append({"agent": event.author, "elapsed_seconds": round(time.monotonic() - started, 2)})
            if not trace:
                raise HTTPException(502, "The coach returned an empty reply. Please try again.")
            return {"mode": "live", "reply": reply, "trace": trace}
    except TimeoutError:
        raise HTTPException(504, "The coach is taking too long. Please try again.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "The coach could not reply. Check model access and cloud configuration.")
    finally:
        await session_service.delete_session(app_name=APP_NAME, user_id=uid, session_id=sid)

