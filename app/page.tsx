"use client";
import { useState } from "react";
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
  Housing: 1400,
  Food: 480,
  Transport: 180,
  Utilities: 160,
  Lifestyle: 260,
};
const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
function Detail({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <div className="details">
        {value.map((v, i) => (
          <div className="detail" key={i}>
            <Detail value={v} />
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
            <Detail value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default function Home() {
  const [income, setIncome] = useState(4800),
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
  const total = Object.values(expenses).reduce((a, b) => a + b, 0);
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
        <div className="aside-bottom">
          <span className="small-dot" /> A little clarity. A lot of possibility.
          <p>Personal finance, with a plan.</p>
        </div>
      </aside>
      <main id="overview">
        <header>
          <span>YOUR MONEY, IN PERSPECTIVE</span>
          <span className="pill">◌ Personal workspace</span>
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
              <span className="subtle">USD / month</span>
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
                  <span className={"category c" + i}>
                    {["⌂", "◡", "↗", "ϟ", "✧"][i]}
                  </span>
                  {name}
                </label>
                <div>
                  <span>$</span>
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
                      name: "Credit card",
                      amount: 1000,
                      interest_rate: 18,
                      min_payment: 50,
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
              does not save your financial profile.
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
    </div>
  );
}
