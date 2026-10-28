"use client";
import { useEffect, useRef, useState } from "react";
type Result = {
  mode: string;
  summary: {
    income: number;
    expenses: number;
    remaining: number;
    debt: number;
  };
  trace: { agent: string; elapsed_seconds: number }[];
  results: Record<string, unknown>;
};
const initial = {
  Housing: 25000,
  Food: 18000,
  "Matatu & local transport": 8000,
  Utilities: 6500,
  Lifestyle: 10000,
  "Airtime & mobile money": 4500,
};
const money = (v: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(v);
type ChatMessage = { role: "user" | "assistant"; content: string; mode?: string };
function Detail({ value, label = "" }: { value: unknown; label?: string }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (/percent|percentage|rate/i.test(label)) return <span>{value}%</span>;
    if (/months|dependants/i.test(label)) return <span>{value}</span>;
    return <span>{money(value)}</span>;
  }
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <div className="details">
        {value.map((v, i) => (
          <div className="detail" key={i}>
            <Detail value={v} label={label} />
          </div>
        ))}
      </div>
    );
  return (
    <dl>
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replaceAll("_", " ")}</dt>
          <dd>
            <Detail value={v} label={k} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default function Home() {
  const [income, setIncome] = useState(85000),
    [dependants, setDependants] = useState(0);
  const [expenses, setExpenses] = useState<Record<string, number>>(initial);
  const [debts, setDebts] = useState<
    {
      name: string;
      amount: number;
      interest_rate: number;
      min_payment: number;
    }[]
  >([]);
  const [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [tab, setTab] = useState("budget_analysis");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatMode, setChatMode] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const total = Object.values(expenses).reduce((a, b) => a + b, 0);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatBusy]);
  useEffect(() => {
    if (!chatOpen) {
      previousFocusRef.current?.focus();
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    chatInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatOpen]);
  async function sendChat(text = chatText) {
    const question = text.trim();
    if (!question || chatBusy) return;
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: question }];
    setChatMessages(nextMessages);
    setChatText("");
    setChatBusy(true);
    setChatError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: chatMessages.slice(-10).map(({ role, content }) => ({ role, content })),
          profile: { monthly_income: income, dependants, manual_expenses: expenses, debts },
          analysis_context: result ? JSON.stringify(result.results).slice(0, 12000) : "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The coach could not reply.");
      setChatMode(data.mode || "");
      setChatMessages([...nextMessages, { role: "assistant", content: data.reply, mode: data.mode }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "The coach could not reply.");
    } finally {
      setChatBusy(false);
    }
  }
  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_income: income,
          dependants,
          manual_expenses: expenses,
          debts,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Check your financial inputs.",
        );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          ◒ <span>steady</span>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <a className="nav active" href="#overview">
          ◫ &nbsp; Overview
        </a>
        <a className="nav" href="#profile">
          ↗ &nbsp; Your finances
        </a>
        <a className="nav" href="#analysis">
          ◎ &nbsp; Coaching plan
        </a>
        <button className="nav chat-nav" onClick={() => setChatOpen(true)} aria-expanded={chatOpen}>
          ✳ &nbsp; Ask your coach
        </button>
        <div className="aside-bottom">
          <span className="small-dot" /> A little clarity. A lot of possibility.
          <p>Personal finance, with a plan.</p>
        </div>
      </aside>
      <main id="overview">
        <header>
          <span>YOUR MONEY, IN PERSPECTIVE</span>
          <div className="header-actions">
            <span className="pill">◌ Kenya · Personal workspace</span>
            <button className="chat-trigger" onClick={() => setChatOpen(true)} aria-expanded={chatOpen}>
              ✳ <span>Ask your coach</span>
            </button>
          </div>
        </header>
        <section className="intro">
          <div>
            <p className="eyebrow">LET’S FIND YOUR BALANCE</p>
            <h1>
              Make room for
              <br />
              <em>what matters.</em>
            </h1>
            <p>
              A clearer picture of today.
              <br />A more confident plan for tomorrow.
            </p>
          </div>
          <div
            className="balance-art"
            aria-label="Monthly income remaining after expenses"
          >
            <div className="orbit">
              <div>
                <span>MONTHLY ROOM</span>
                <strong>{money(income - total)}</strong>
                <small>before savings & debt payments</small>
              </div>
            </div>
            <div className="art-caption">
              <span /> YOUR NEXT CHAPTER STARTS HERE
            </div>
          </div>
        </section>
        <div className="stats">
          <article>
            <span>Monthly income</span>
            <strong>{money(income)}</strong>
            <small>After tax, ready to work for you</small>
          </article>
          <article>
            <span>Monthly expenses</span>
            <strong>{money(total)}</strong>
            <small>
              {income > 0 ? Math.round((total / income) * 100) : 0}% of your
              income
            </small>
          </article>
          <article>
            <span>Available balance</span>
            <strong className={income - total < 0 ? "negative" : ""}>
              {money(income - total)}
            </strong>
            <small>
              {income - total < 0
                ? "Expenses exceed income"
                : "Before savings & debt payments"}
            </small>
          </article>
        </div>
        <div className="columns">
          <form id="profile" onSubmit={analyze}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE STARTING POINT</p>
                <h2>Your monthly picture</h2>
              </div>
              <span className="subtle">KES / month</span>
            </div>
            <div className="two">
              <label>
                Take-home income
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10000000000"
                  required
                  value={income}
                  onChange={(e) => setIncome(+e.target.value)}
                />
              </label>
              <label>
                Dependants
                <input
                  type="number"
                  min="0"
                  max="50"
                  required
                  value={dependants}
                  onChange={(e) => setDependants(+e.target.value)}
                />
              </label>
            </div>
            <h3>Where your money goes</h3>
            {Object.entries(expenses).map(([name, value], i) => (
              <div className="expense" key={name}>
                <label htmlFor={name}>
                  <span className={"category c" + (i % 5)}>
                    {["⌂", "◡", "↗", "ϟ", "✧"][i % 5]}
                  </span>
                  {name}
                </label>
                <div>
                  <span>KSh</span>
                  <input
                    id={name}
                    aria-label={name + " monthly expense"}
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000000000"
                    required
                    value={value}
                    onChange={(e) =>
                      setExpenses({ ...expenses, [name]: +e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
            <div className="debt-head">
              <h3>Debts to work through</h3>
              <button
                type="button"
                className="text-button"
                disabled={debts.length >= 10}
                onClick={() =>
                  setDebts([
                    ...debts,
                    {
                      name: "Loan",
                      amount: 15000,
                      interest_rate: 18,
                      min_payment: 1500,
                    },
                  ])
                }
              >
                + Add debt
              </button>
            </div>
            {debts.length === 0 && (
              <p className="subtle">
                No debts added. Add a balance for a payoff strategy.
              </p>
            )}
            {debts.map((debt, i) => (
              <fieldset key={i}>
                <legend>Debt {i + 1}</legend>
                {(
                  ["name", "amount", "interest_rate", "min_payment"] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        name: "Name",
                        amount: "Balance",
                        interest_rate: "Annual interest %",
                        min_payment: "Minimum payment",
                      }[k]
                    }
                    <input
                      required
                      type={k === "name" ? "text" : "number"}
                      min="0"
                      max={k === "interest_rate" ? 100 : undefined}
                      step="any"
                      value={debt[k]}
                      onChange={(e) =>
                        setDebts(
                          debts.map((d, j) =>
                            j === i
                              ? {
                                  ...d,
                                  [k]:
                                    k === "name"
                                      ? e.target.value
                                      : +e.target.value,
                                }
                              : d,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDebts(debts.filter((_, j) => i !== j))}
                >
                  Remove debt
                </button>
              </fieldset>
            ))}
            <button className="primary" disabled={busy}>
              {busy ? "Your coach is working…" : "Build my coaching plan"}{" "}
              <span>↗</span>
            </button>
            <p className="privacy">
              Live mode sends these inputs to Google Vertex AI. This prototype
              does not save your financial profile. Sample figures are synthetic;
              edit them to match your month.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
          <section className="right">
            <article className="coach-card">
              <span className="coach-icon">✳</span>
              <p className="eyebrow">THREE PERSPECTIVES. ONE PLAN.</p>
              <h2>
                A coach for every
                <br />
                part of your money.
              </h2>
              <p>
                Your budget, savings, and debts work together. Your plan should
                too.
              </p>
              <div className="steps">
                {[
                  [
                    "01",
                    "Understand your spending",
                    "Find breathing room in your budget.",
                  ],
                  [
                    "02",
                    "Give your savings direction",
                    "Make space for your future goals.",
                  ],
                  [
                    "03",
                    "Find your path out of debt",
                    "Compare ways to move forward.",
                  ],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <div>
                      <h3>{t}</h3>
                      <p>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="note">
              <span>↗</span>
              <div>
                <h3>Small steps add up.</h3>
                <p>
                  Start with a typical month. You can adjust your numbers and
                  explore another plan anytime.
                </p>
              </div>
            </article>
          </section>
        </div>
        <section id="analysis" className="analysis" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR NEXT STEPS</p>
              <h2>Your coaching plan</h2>
            </div>
            {result && (
              <span className="pill">
                {result.mode === "demo"
                  ? "Demo · no AI calls"
                        : "Live · Google ADK"}
              </span>
            )}
          </div>
          {busy ? (
            <p>
              Reviewing your budget, savings, and debts. This can take a few
              minutes.
            </p>
          ) : result ? (
            <>
              <div className="tabs" role="tablist">
                {Object.keys(result.results).map((k) => (
                  <button
                    role="tab"
                    aria-selected={tab === k}
                    key={k}
                    className={tab === k ? "selected" : ""}
                    onClick={() => setTab(k)}
                  >
                    {k.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
              <Detail value={result.results[tab]} />
              {result.trace.length > 0 && (
                <details>
                  <summary>Agent execution details</summary>
                  {result.trace.map((t, i) => (
                    <p key={i}>
                      {t.agent} · {t.elapsed_seconds}s elapsed
                    </p>
                  ))}
                </details>
              )}
            </>
          ) : (
            <div className="empty">
              <span>◎</span>
              <p>Your next chapter is ready when you are.</p>
              <small>Add your monthly numbers and build your first plan.</small>
            </div>
          )}
        </section>
        <footer>
          Steady · Built for a more intentional financial life.
          <span>
            Educational guidance. Review AI-generated figures before acting.
          </span>
        </footer>
      </main>
      {chatOpen && (
        <>
          <button className="chat-backdrop" aria-label="Close money coach chat" onClick={() => setChatOpen(false)} />
          <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input, [tabindex]:not([tabindex='-1'])");
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }}>
            <div className="chat-header">
              <div className="chat-avatar" aria-hidden="true">✳</div>
              <div>
                <h2 id="chat-title">Your money coach</h2>
                <p>{chatMode === "live" ? "Google ADK · Vertex AI" : chatMode === "demo" ? "Demo mode · AI not connected" : "Kenya · KES"}</p>
              </div>
              <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">×</button>
            </div>
            <div className="chat-transcript" aria-live="polite" aria-relevant="additions text">
              {chatMessages.length === 0 && (
                <div className="chat-welcome">
                  <span className="eyebrow">A CLEARER NEXT STEP</span>
                  <p>Ask about your budget, savings, or a debt strategy. Your current KES figures are included for context.</p>
                  <button onClick={() => void sendChat("How much room do I have after my monthly expenses?")}>How much is left after expenses? <span>↗</span></button>
                  <button onClick={() => void sendChat("How could I make a plan for my debt repayments?")}>Help me plan debt repayments <span>↗</span></button>
                </div>
              )}
              {chatMessages.map((message, index) => (
                <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}>
                  <span>{message.role === "assistant" ? "Coach" : "You"}{message.mode === "demo" ? " · Demo" : ""}</span>
                  <p>{message.content}</p>
                </div>
              ))}
              {chatBusy && <p className="chat-thinking" role="status">Your coach is thinking…</p>}
              {chatError && <p className="error" role="alert">{chatError}</p>}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendChat(); }}>
              <label className="sr-only" htmlFor="chat-input">Message your money coach</label>
              <textarea ref={chatInputRef} id="chat-input" rows={2} maxLength={1200} placeholder="Ask about your monthly plan…" value={chatText} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendChat(); } }} />
              <button disabled={!chatText.trim() || chatBusy} aria-label="Send message">↑</button>
              <small>Never share PINs or account numbers. Guidance is educational.</small>
            </form>
          </section>
        </>
      )}
      <button className="chat-fab" onClick={() => setChatOpen(true)} aria-expanded={chatOpen} aria-label="Open money coach chat">✳ <span>Ask your coach</span></button>
    </div>
  );
}

