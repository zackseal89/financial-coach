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

type DebtItem = {
  name: string;
  amount: number;
  interest_rate: number;
  min_payment: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
};

type AgentStatus = "waiting" | "working" | "done";
type AgentStep = {
  agent: string;
  shortName: string;
  label: string;
  description: string;
  stateKey: string;
  status: AgentStatus;
  elapsed_seconds?: number;
};

const initialExpenses: Record<string, number> = {
  Housing: 25000,
  Food: 18000,
  "Matatu & local transport": 8000,
  Utilities: 6500,
  Lifestyle: 10000,
  "Airtime & mobile money": 4500,
};

const SCENARIO_PRESETS: {
  id: string;
  label: string;
  badge: string;
  income: number;
  dependants: number;
  expenses: Record<string, number>;
  debts: DebtItem[];
}[] = [
  {
    id: "starter",
    label: "Nairobi Solo Starter",
    badge: "Default KES 85k",
    income: 85000,
    dependants: 0,
    expenses: initialExpenses,
    debts: [],
  },
  {
    id: "family",
    label: "Growing Household",
    badge: "2 dependants · SACCO",
    income: 165000,
    dependants: 2,
    expenses: {
      Housing: 45000,
      Food: 34000,
      "Matatu & local transport": 14000,
      Utilities: 11500,
      Lifestyle: 12000,
      "Airtime & mobile money": 6500,
    },
    debts: [
      {
        name: "SACCO Development Loan",
        amount: 240000,
        interest_rate: 14,
        min_payment: 12000,
      },
    ],
  },
  {
    id: "debt_sprint",
    label: "Debt Payoff Sprint",
    badge: "2 active balances",
    income: 110000,
    dependants: 1,
    expenses: {
      Housing: 30000,
      Food: 22000,
      "Matatu & local transport": 9500,
      Utilities: 7500,
      Lifestyle: 8500,
      "Airtime & mobile money": 5000,
    },
    debts: [
      {
        name: "Mobile Digital Facility",
        amount: 28000,
        interest_rate: 24,
        min_payment: 3500,
      },
      {
        name: "Bank Personal Loan",
        amount: 145000,
        interest_rate: 17.5,
        min_payment: 7200,
      },
    ],
  },
];

const money = (v: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);

const agentStages: AgentStep[] = [
  {
    agent: "BudgetAnalysisAgent",
    shortName: "01 · Budget Specialist",
    label: "Understand your spending",
    description: "Categorizes KES cashflow, essential vs discretionary ratios, and savings opportunities.",
    stateKey: "budget_analysis",
    status: "waiting",
  },
  {
    agent: "SavingsStrategyAgent",
    shortName: "02 · Savings Strategist",
    label: "Shape a savings plan",
    description: "Reads budget_analysis to size your emergency runway and monthly goal allocations.",
    stateKey: "savings_strategy",
    status: "waiting",
  },
  {
    agent: "DebtReductionAgent",
    shortName: "03 · Debt Architect",
    label: "Compare debt paths",
    description: "Combines budget + savings context to model Avalanche vs Snowball payoff timelines.",
    stateKey: "debt_reduction",
    status: "waiting",
  },
];

const CATEGORY_COLORS = [
  "#0B6E4F", // Emerald
  "#D97706", // Warm Amber
  "#2563EB", // Cobalt Blue
  "#7C3AED", // Violet
  "#0891B2", // Cyan
  "#E11D48", // Rose
];

function plainText(value: string) {
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, "")
    .replace(/^\s*\|\s*/gm, "")
    .replace(/\s*\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, " · ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function CategoryIcon({ name, index }: { name: string; index: number }) {
  const lower = name.toLowerCase();
  if (lower.includes("hous") || lower.includes("rent")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }
  if (lower.includes("food") || lower.includes("grocer")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v7a4 4 0 0 0 4 4h1v7" />
        <path d="M7 3v7" />
        <path d="M11 3v7a4 4 0 0 1-4 4" />
        <path d="M17 3v18" />
        <path d="M17 3a4 4 0 0 1 4 4v4h-4" />
      </svg>
    );
  }
  if (lower.includes("matatu") || lower.includes("transport") || lower.includes("fuel")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="16" height="13" rx="3" />
        <path d="M4 11h16" />
        <path d="M7.5 17v3" />
        <path d="M16.5 17v3" />
        <circle cx="8" cy="14" r="1" fill="currentColor" />
        <circle cx="16" cy="14" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (lower.includes("util") || lower.includes("power") || lower.includes("water")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" />
      </svg>
    );
  }
  if (lower.includes("airtime") || lower.includes("mobile") || lower.includes("mpesa")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M10 6h4" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  const fallbackIdx = index % 3;
  if (fallbackIdx === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l2.6 5.4 5.9.9-4.2 4.1 1 5.9L12 16.5 6.7 19.3l1-5.9-4.2-4.1 5.9-.9L12 3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </svg>
  );
}

function Detail({ value, label = "" }: { value: unknown; label?: string }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (/percent|percentage|rate/i.test(label)) return <span>{value}%</span>;
    if (/months|dependants/i.test(label)) return <span>{value}</span>;
    return <span>{money(value)}</span>;
  }
  if (typeof value !== "object") return <span>{plainText(String(value))}</span>;
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
    <dl className="fallback-dl">
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

function PlanRenderer({
  tabKey,
  data,
  mode,
}: {
  tabKey: string;
  data: unknown;
  mode: string;
}) {
  if (!isRecord(data)) {
    return <Detail value={data} label={tabKey} />;
  }

  const note = typeof data.note === "string" ? plainText(data.note) : null;

  if (tabKey === "budget_analysis") {
    const categories = Array.isArray(data.spending_categories)
      ? data.spending_categories.filter(isRecord)
      : [];
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations.filter(isRecord)
      : [];
    const totalExpenses =
      typeof data.total_expenses === "number"
        ? data.total_expenses
        : categories.reduce(
            (sum, item) =>
              sum + (typeof item.amount === "number" ? item.amount : 0),
            0,
          );
    const monthlyIncome =
      typeof data.monthly_income === "number" ? data.monthly_income : null;
    const totalPotentialSavings = recommendations.reduce(
      (sum, rec) =>
        sum +
        (typeof rec.potential_savings === "number" ? rec.potential_savings : 0),
      0,
    );

    const knownKeys = new Set([
      "note",
      "total_expenses",
      "monthly_income",
      "spending_categories",
      "recommendations",
    ]);
    const extraEntries = Object.entries(data).filter(
      ([k]) => !knownKeys.has(k),
    );

    return (
      <div className="plan-view">
        {note && (
          <div className={`mode-banner ${mode === "demo" ? "demo" : "live"}`}>
            <div className="mode-banner-badge">
              {mode === "demo" ? "DEMO ARITHMETIC" : "SPECIALIST NOTE"}
            </div>
            <p>{note}</p>
          </div>
        )}

        <div className="plan-kpi-grid">
          <div className="plan-kpi-card">
            <span>Analyzed monthly spend</span>
            <strong>{money(totalExpenses)}</strong>
            <small>Across {categories.length} tracked categories</small>
          </div>
          {monthlyIncome !== null && (
            <div className="plan-kpi-card">
              <span>Monthly take-home</span>
              <strong>{money(monthlyIncome)}</strong>
              <small>
                {monthlyIncome > 0
                  ? `${Math.round((totalExpenses / monthlyIncome) * 100)}% committed to expenses`
                  : "No income entered"}
              </small>
            </div>
          )}
          {totalPotentialSavings > 0 && (
            <div className="plan-kpi-card highlight">
              <span>Identified monthly room</span>
              <strong>{money(totalPotentialSavings)}</strong>
              <small>Estimated savings from recommendations</small>
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Category breakdown</h3>
              <span>Share of monthly spend</span>
            </div>
            <div className="plan-category-grid">
              {categories.map((cat, idx) => {
                const name = String(cat.category ?? `Category ${idx + 1}`);
                const amount = typeof cat.amount === "number" ? cat.amount : 0;
                const pct =
                  typeof cat.percentage === "number"
                    ? cat.percentage
                    : totalExpenses > 0
                      ? Math.round((amount / totalExpenses) * 100)
                      : 0;
                return (
                  <div className="plan-category-item" key={`${name}-${idx}`}>
                    <div className="plan-category-top">
                      <span className="plan-category-name">{plainText(name)}</span>
                      <span className="plan-category-pct">{Math.round(pct)}%</span>
                    </div>
                    <strong className="plan-category-amt">{money(amount)}</strong>
                    <div className="plan-mini-bar">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, pct))}%`,
                          background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Actionable budget adjustments</h3>
              <span>{recommendations.length} recommendations</span>
            </div>
            <div className="rec-list">
              {recommendations.map((rec, idx) => {
                const cat = String(rec.category ?? "General");
                const text = String(rec.recommendation ?? "");
                const savings =
                  typeof rec.potential_savings === "number"
                    ? rec.potential_savings
                    : null;
                return (
                  <article className="rec-card" key={idx}>
                    <div className="rec-card-head">
                      <span className="rec-index">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="rec-tag">{plainText(cat)}</span>
                      {savings !== null && savings > 0 && (
                        <span className="rec-savings-pill">
                          Save {money(savings)} / mo
                        </span>
                      )}
                    </div>
                    <p>{plainText(text)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {extraEntries.length > 0 && (
          <Detail value={Object.fromEntries(extraEntries)} label={tabKey} />
        )}
      </div>
    );
  }

  if (tabKey === "savings_strategy") {
    const emergencyFund = isRecord(data.emergency_fund)
      ? data.emergency_fund
      : null;
    const illustrativeFund =
      typeof data.illustrative_emergency_fund === "number"
        ? data.illustrative_emergency_fund
        : null;
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations.filter(isRecord)
      : [];
    const automations = Array.isArray(data.automation_techniques)
      ? data.automation_techniques.filter(isRecord)
      : [];

    const knownKeys = new Set([
      "note",
      "emergency_fund",
      "illustrative_emergency_fund",
      "recommendations",
      "automation_techniques",
    ]);
    const extraEntries = Object.entries(data).filter(
      ([k]) => !knownKeys.has(k),
    );

    return (
      <div className="plan-view">
        {note && (
          <div className={`mode-banner ${mode === "demo" ? "demo" : "live"}`}>
            <div className="mode-banner-badge">
              {mode === "demo" ? "DEMO ILLUSTRATION" : "SAVINGS NOTE"}
            </div>
            <p>{note}</p>
          </div>
        )}

        {(emergencyFund || illustrativeFund !== null) && (
          <div className="emergency-hero">
            <div className="emergency-hero-copy">
              <span className="eyebrow">SAFETY BUFFER TARGET</span>
              <h3>Emergency reserve runway</h3>
              <p>
                {emergencyFund && typeof emergencyFund.current_status === "string"
                  ? plainText(emergencyFund.current_status)
                  : "Calculated as 6× your current monthly expenses to protect your household against income shocks."}
              </p>
            </div>
            <div className="emergency-hero-figures">
              <div>
                <span>Target buffer</span>
                <strong>
                  {money(
                    emergencyFund &&
                      typeof emergencyFund.recommended_amount === "number"
                      ? emergencyFund.recommended_amount
                      : illustrativeFund ?? 0,
                  )}
                </strong>
                <small>6 months of core expenses</small>
              </div>
              {emergencyFund &&
                typeof emergencyFund.current_amount === "number" && (
                  <div>
                    <span>Current reserve</span>
                    <strong>{money(emergencyFund.current_amount)}</strong>
                    <small>Reported starting balance</small>
                  </div>
                )}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Recommended monthly allocations</h3>
              <span>Goal buckets</span>
            </div>
            <div className="rec-list">
              {recommendations.map((rec, idx) => {
                const cat = String(rec.category ?? "Savings Goal");
                const amount = typeof rec.amount === "number" ? rec.amount : 0;
                const rationale =
                  typeof rec.rationale === "string" ? rec.rationale : "";
                return (
                  <article className="rec-card" key={idx}>
                    <div className="rec-card-head">
                      <span className="rec-index">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <strong className="rec-title">{plainText(cat)}</strong>
                      <span className="rec-savings-pill">
                        {money(amount)} / mo
                      </span>
                    </div>
                    {rationale && <p>{plainText(rationale)}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {automations.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Habit & automation techniques</h3>
              <span>Make saving effortless</span>
            </div>
            <div className="automation-grid">
              {automations.map((auto, idx) => (
                <div className="automation-card" key={idx}>
                  <strong>{plainText(String(auto.name ?? "Technique"))}</strong>
                  <p>{plainText(String(auto.description ?? ""))}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {extraEntries.length > 0 && (
          <Detail value={Object.fromEntries(extraEntries)} label={tabKey} />
        )}
      </div>
    );
  }

  if (tabKey === "debt_reduction") {
    const totalDebt =
      typeof data.total_debt === "number" ? data.total_debt : 0;
    const debtsList = Array.isArray(data.debts)
      ? data.debts.filter(isRecord)
      : [];
    const payoffPlans = isRecord(data.payoff_plans) ? data.payoff_plans : null;
    const avalanche =
      payoffPlans && isRecord(payoffPlans.avalanche)
        ? payoffPlans.avalanche
        : null;
    const snowball =
      payoffPlans && isRecord(payoffPlans.snowball)
        ? payoffPlans.snowball
        : null;
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations.filter(isRecord)
      : [];

    const knownKeys = new Set([
      "note",
      "total_debt",
      "debts",
      "payoff_plans",
      "recommendations",
    ]);
    const extraEntries = Object.entries(data).filter(
      ([k]) => !knownKeys.has(k),
    );

    return (
      <div className="plan-view">
        {note && (
          <div className={`mode-banner ${mode === "demo" ? "demo" : "live"}`}>
            <div className="mode-banner-badge">
              {mode === "demo" ? "DEMO DISCLOSURE" : "DEBT STRATEGY"}
            </div>
            <p>{note}</p>
          </div>
        )}

        <div className="plan-kpi-grid">
          <div className="plan-kpi-card">
            <span>Total tracked debt</span>
            <strong>{money(totalDebt)}</strong>
            <small>
              {totalDebt === 0
                ? "Debt-free baseline"
                : `${debtsList.length || "Active"} balance(s) included`}
            </small>
          </div>
          {avalanche && typeof avalanche.months_to_payoff === "number" && (
            <div className="plan-kpi-card highlight">
              <span>Avalanche timeline</span>
              <strong>{avalanche.months_to_payoff} months</strong>
              <small>
                Est. interest:{" "}
                {typeof avalanche.total_interest === "number"
                  ? money(avalanche.total_interest)
                  : "N/A"}
              </small>
            </div>
          )}
          {snowball && typeof snowball.months_to_payoff === "number" && (
            <div className="plan-kpi-card">
              <span>Snowball timeline</span>
              <strong>{snowball.months_to_payoff} months</strong>
              <small>
                Est. interest:{" "}
                {typeof snowball.total_interest === "number"
                  ? money(snowball.total_interest)
                  : "N/A"}
              </small>
            </div>
          )}
        </div>

        {(avalanche || snowball) && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Payoff strategy comparison</h3>
              <span>Mathematical optimum vs psychological momentum</span>
            </div>
            <div className="strategy-compare-grid">
              {avalanche && (
                <div className="strategy-card recommended">
                  <div className="strategy-card-top">
                    <div>
                      <span className="strategy-badge">LOWEST INTEREST COST</span>
                      <h4>Avalanche Method</h4>
                    </div>
                    <p>Prioritizes the highest annual interest rate first while paying minimums on the rest.</p>
                  </div>
                  <div className="strategy-metrics">
                    <div>
                      <span>Time to debt freedom</span>
                      <strong>
                        {typeof avalanche.months_to_payoff === "number"
                          ? `${avalanche.months_to_payoff} mos`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Total interest paid</span>
                      <strong>
                        {typeof avalanche.total_interest === "number"
                          ? money(avalanche.total_interest)
                          : "—"}
                      </strong>
                    </div>
                    {typeof avalanche.monthly_payment === "number" && (
                      <div>
                        <span>Monthly target</span>
                        <strong>{money(avalanche.monthly_payment)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {snowball && (
                <div className="strategy-card">
                  <div className="strategy-card-top">
                    <div>
                      <span className="strategy-badge neutral">FASTEST EARLY WINS</span>
                      <h4>Snowball Method</h4>
                    </div>
                    <p>Clears the smallest KES balance first to free up cashflow and build momentum.</p>
                  </div>
                  <div className="strategy-metrics">
                    <div>
                      <span>Time to debt freedom</span>
                      <strong>
                        {typeof snowball.months_to_payoff === "number"
                          ? `${snowball.months_to_payoff} mos`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Total interest paid</span>
                      <strong>
                        {typeof snowball.total_interest === "number"
                          ? money(snowball.total_interest)
                          : "—"}
                      </strong>
                    </div>
                    {typeof snowball.monthly_payment === "number" && (
                      <div>
                        <span>Monthly target</span>
                        <strong>{money(snowball.monthly_payment)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {debtsList.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Analyzed obligations</h3>
              <span>{debtsList.length} accounts</span>
            </div>
            <div className="plan-category-grid">
              {debtsList.map((d, idx) => (
                <div className="plan-category-item" key={idx}>
                  <div className="plan-category-top">
                    <span className="plan-category-name">
                      {plainText(String(d.name ?? `Debt ${idx + 1}`))}
                    </span>
                    {typeof d.interest_rate === "number" && (
                      <span className="plan-category-pct">
                        {d.interest_rate}% APR
                      </span>
                    )}
                  </div>
                  <strong className="plan-category-amt">
                    {typeof d.amount === "number" ? money(d.amount) : "—"}
                  </strong>
                  {typeof d.min_payment === "number" && (
                    <small className="subtle">
                      Min payment: {money(d.min_payment)} / mo
                    </small>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="plan-block">
            <div className="plan-block-header">
              <h3>Next steps to accelerate payoff</h3>
              <span>Specialist guidance</span>
            </div>
            <div className="rec-list">
              {recommendations.map((rec, idx) => (
                <article className="rec-card" key={idx}>
                  <div className="rec-card-head">
                    <span className="rec-index">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <strong className="rec-title">
                      {plainText(String(rec.title ?? "Action step"))}
                    </strong>
                    {typeof rec.impact === "string" && (
                      <span className="rec-savings-pill">
                        {plainText(rec.impact)}
                      </span>
                    )}
                  </div>
                  <p>{plainText(String(rec.description ?? ""))}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {extraEntries.length > 0 && (
          <Detail value={Object.fromEntries(extraEntries)} label={tabKey} />
        )}
      </div>
    );
  }

  return <Detail value={data} label={tabKey} />;
}

export default function Home() {
  const [income, setIncome] = useState(85000);
  const [dependants, setDependants] = useState(0);
  const [expenses, setExpenses] =
    useState<Record<string, number>>(initialExpenses);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [activePreset, setActivePreset] = useState("starter");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("budget_analysis");
  const [activeSection, setActiveSection] = useState("overview");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatMode, setChatMode] = useState("");
  const [agentProgress, setAgentProgress] = useState<AgentStep[]>(agentStages);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const total = Object.values(expenses).reduce((a, b) => a + b, 0);
  const remaining = income - total;
  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
  const totalMinDebtPayment = debts.reduce((sum, d) => sum + d.min_payment, 0);
  const expenseRatio = income > 0 ? Math.round((total / income) * 100) : 0;
  const savingsRate = income > 0 ? Math.round((remaining / income) * 100) : 0;
  const spendingRows = Object.entries(expenses).sort((a, b) => b[1] - a[1]);

  // SVG Ring Math
  const ringRadius = 92;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedSpendShare =
    income > 0 ? Math.min(1, Math.max(0, total / income)) : 1;
  const spendStrokeLength = clampedSpendShare * ringCircumference;

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

  function applyPreset(presetId: string) {
    const found = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePreset(found.id);
    setIncome(found.income);
    setDependants(found.dependants);
    setExpenses({ ...found.expenses });
    setDebts(found.debts.map((d) => ({ ...d })));
    setError("");
  }

  function handleAddCategory() {
    const clean = newCategoryName.trim();
    if (!clean || Object.keys(expenses).length >= 30) return;
    if (Object.prototype.hasOwnProperty.call(expenses, clean)) {
      setNewCategoryName("");
      setShowAddCategory(false);
      return;
    }
    setExpenses({ ...expenses, [clean]: 5000 });
    setNewCategoryName("");
    setShowAddCategory(false);
    setActivePreset("custom");
  }

  async function sendChat(text = chatText) {
    const question = text.trim();
    if (!question || chatBusy) return;
    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: question },
    ];
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
          history: chatMessages
            .slice(-10)
            .map(({ role, content }) => ({ role, content })),
          profile: {
            monthly_income: income,
            dependants,
            manual_expenses: expenses,
            debts,
          },
          analysis_context: result
            ? JSON.stringify(result.results).slice(0, 12000)
            : "",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "The coach could not reply.",
        );
      setChatMode(data.mode || "");
      setChatMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply, mode: data.mode },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "The coach could not reply.",
      );
    } finally {
      setChatBusy(false);
    }
  }

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setAgentProgress(
      agentStages.map((step) => ({ ...step, status: "waiting" })),
    );
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          monthly_income: income,
          dependants,
          manual_expenses: expenses,
          debts,
        }),
      });
      if (!response.ok) {
        const failure = await response.json();
        throw new Error(
          typeof failure.detail === "string"
            ? failure.detail
            : "Check your financial inputs.",
        );
      }
      let finalResult: Result | null = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError = "";
        const consume = (record: string) => {
          const dataLine = record
            .split(/\r?\n/)
            .find((line) => line.startsWith("data:"));
          if (!dataLine) return;
          const event = JSON.parse(dataLine.slice(5).trim());
          if (event.type === "progress") {
            setAgentProgress((current) =>
              current.map((step) =>
                step.agent === event.agent
                  ? {
                      ...step,
                      status: event.status === "done" ? "done" : "working",
                      elapsed_seconds: event.elapsed_seconds,
                    }
                  : step,
              ),
            );
          } else if (event.type === "result") {
            finalResult = event.result as Result;
          } else if (event.type === "error") {
            streamError = event.detail || "Analysis failed.";
          }
        };
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const records = buffer.split(/\r?\n\r?\n/);
          buffer = records.pop() || "";
          records.forEach(consume);
          if (done) {
            if (buffer.trim()) consume(buffer);
            break;
          }
        }
        if (streamError) throw new Error(streamError);
      } else {
        finalResult = (await response.json()) as Result;
      }
      if (!finalResult)
        throw new Error(
          "The coach finished without returning a plan. Please retry.",
        );
      setResult(finalResult);
      document
        .getElementById("analysis")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  const tabMeta: Record<string, { label: string; badge: string }> = {
    budget_analysis: { label: "Budget analysis", badge: "01 · Spending" },
    savings_strategy: { label: "Savings strategy", badge: "02 · Runway" },
    debt_reduction: { label: "Debt reduction", badge: "03 · Payoff" },
  };

  return (
    <div className="shell">
      <aside aria-label="Workspace sidebar">
        <div className="aside-top">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" opacity="0.14" />
                <path
                  d="M7 14.5c2.2 2 4.5 2 6.5 0s4.3-2 3.5-5c-.6-2.2-3.5-2.5-6-1.5S6.5 11 8.5 12.2c2 1.2 5.5.8 7.5-.7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="brand-text">
              <span>steady</span>
              <small>KENYA · KES</small>
            </div>
          </a>

          <div className="workspace">YOUR WORKSPACE</div>
          <nav className="side-nav" aria-label="Desktop navigation">
            <a
              className={`nav ${activeSection === "overview" ? "active" : ""}`}
              href="#overview"
              onClick={() => setActiveSection("overview")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>Overview</span>
            </a>
            <a
              className={`nav ${activeSection === "spending" ? "active" : ""}`}
              href="#spending"
              onClick={() => setActiveSection("spending")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
                <path d="M16 19h6" />
                <path d="M19 16v6" />
                <path d="M3 10h18" />
              </svg>
              <span>Spending map</span>
            </a>
            <a
              className={`nav ${activeSection === "profile" ? "active" : ""}`}
              href="#profile"
              onClick={() => setActiveSection("profile")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Your finances</span>
            </a>
            <a
              className={`nav ${activeSection === "analysis" ? "active" : ""}`}
              href="#analysis"
              onClick={() => setActiveSection("analysis")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span>Coaching plan</span>
              {result && <em className="nav-badge">Ready</em>}
            </a>
            <button
              type="button"
              className="nav chat-nav"
              onClick={() => setChatOpen(true)}
              aria-expanded={chatOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span>Ask your coach</span>
            </button>
          </nav>
        </div>

        <div className="aside-bottom">
          <div className="aside-status-card">
            <div className="aside-status-row">
              <span className="small-dot" />
              <strong>Google ADK Pipeline</strong>
            </div>
            <p>3 sequential specialists + contextual KES chat advisor.</p>
          </div>
          <p className="aside-tagline">
            A little clarity. A lot of possibility. Personal finance, with a plan.
          </p>
        </div>
      </aside>

      <main id="overview">
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="top-kicker">YOUR MONEY, IN PERSPECTIVE</span>
            <span className="top-divider" aria-hidden="true">·</span>
            <span className="top-locale">Nairobi / Kenya (KES)</span>
          </div>
          <div className="header-actions">
            <span className="pill">
              <span className="status-indicator" aria-hidden="true" />
              {result?.mode === "live"
                ? "Live · Google ADK"
                : result?.mode === "demo"
                  ? "Demo mode · Local math"
                  : "Kenya · Personal workspace"}
            </span>
            <button
              type="button"
              className="chat-trigger"
              onClick={() => setChatOpen(true)}
              aria-expanded={chatOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" />
              </svg>
              <span>Ask your coach</span>
            </button>
          </div>
        </header>

        <section className="intro" aria-label="Monthly balance overview">
          <div className="intro-copy">
            <div className="eyebrow-row">
              <p className="eyebrow">LET’S FIND YOUR BALANCE</p>
              <span className="eyebrow-chip">Multi-Agent Financial Workspace</span>
            </div>
            <h1>
              Make room for{" "}
              <em>what matters.</em>
            </h1>
            <p className="intro-lead">
              A clearer picture of your monthly Kenyan shilling cashflow today —
              and a structured, three-specialist plan for your budget, emergency
              runway, and debt freedom tomorrow.
            </p>

            <div className="preset-bar" aria-label="Sample household scenarios">
              <span className="preset-label">Try a household scenario:</span>
              <div className="preset-buttons">
                {SCENARIO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-chip ${activePreset === preset.id ? "active" : ""}`}
                    onClick={() => applyPreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className="balance-art"
            aria-label="Monthly income remaining after expenses"
          >
            <div className="gauge-card">
              <div className="gauge-header">
                <span>CASHFLOW HEALTH</span>
                <span
                  className={`health-badge ${
                    remaining < 0
                      ? "danger"
                      : savingsRate >= 20
                        ? "optimal"
                        : "caution"
                  }`}
                >
                  {remaining < 0
                    ? "Monthly Deficit"
                    : savingsRate >= 20
                      ? `${savingsRate}% Free Margin`
                      : `${savingsRate}% Tight Margin`}
                </span>
              </div>

              <div className="orbit-wrap">
                <svg
                  className="orbit-svg"
                  viewBox="0 0 220 220"
                  aria-hidden="true"
                >
                  <circle
                    className="orbit-track"
                    cx="110"
                    cy="110"
                    r={ringRadius}
                  />
                  <circle
                    className={`orbit-progress ${remaining < 0 ? "over" : ""}`}
                    cx="110"
                    cy="110"
                    r={ringRadius}
                    strokeDasharray={`${spendStrokeLength} ${ringCircumference}`}
                  />
                </svg>
                <div className="orbit-center">
                  <span>MONTHLY ROOM</span>
                  <strong className={remaining < 0 ? "negative" : ""}>
                    {money(remaining)}
                  </strong>
                  <small>before savings &amp; debt payments</small>
                </div>
              </div>

              <div className="gauge-footer">
                <div>
                  <span>Expense ratio</span>
                  <strong>{expenseRatio}% of income</strong>
                </div>
                <div>
                  <span>Active debts</span>
                  <strong>
                    {debts.length === 0 ? "None" : money(totalDebt)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="stats" role="region" aria-label="Key monthly figures">
          <article className="stat-card">
            <div className="stat-top">
              <span>Monthly income</span>
              <span className="stat-badge positive">Take-home KES</span>
            </div>
            <strong>{money(income)}</strong>
            <small>
              After tax, ready to work for you
              {dependants > 0 ? ` · ${dependants} dependant(s)` : ""}
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Monthly expenses</span>
              <span className="stat-badge neutral">
                {Object.keys(expenses).length} categories
              </span>
            </div>
            <strong>{money(total)}</strong>
            <small>
              {income > 0 ? Math.round((total / income) * 100) : 0}% of your
              income committed
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Available balance</span>
              <span
                className={`stat-badge ${
                  remaining < 0 ? "danger" : "positive"
                }`}
              >
                {remaining < 0 ? "Deficit" : "Unallocated"}
              </span>
            </div>
            <strong className={remaining < 0 ? "negative" : "positive-text"}>
              {money(remaining)}
            </strong>
            <small>
              {remaining < 0
                ? "Expenses exceed income"
                : totalMinDebtPayment > 0
                  ? `${money(remaining - totalMinDebtPayment)} after ${money(totalMinDebtPayment)} min debt payments`
                  : "Before savings & debt payments"}
            </small>
          </article>
        </div>

        <section
          id="spending"
          className="spending-map"
          aria-labelledby="spending-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">A MONTH AT A GLANCE</p>
              <h2 id="spending-title">Your spending map</h2>
            </div>
            <div className="spending-summary-pills">
              <span className="subtle-pill">{money(total)} total spend</span>
              <span className="subtle-pill">
                Largest: {spendingRows[0]?.[0] ?? "—"}
              </span>
            </div>
          </div>

          {total > 0 && (
            <div
              className="stacked-bar"
              aria-label="Proportional category spending bar"
            >
              {spendingRows.map(([name, amount], index) => {
                const share = (amount / total) * 100;
                if (share <= 0) return null;
                return (
                  <div
                    key={name}
                    className="stacked-segment"
                    style={{
                      width: `${share}%`,
                      background:
                        CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                    }}
                    title={`${name}: ${money(amount)} (${Math.round(share)}%)`}
                  />
                );
              })}
            </div>
          )}

          <div className="spending-list">
            {spendingRows.map(([name, amount], index) => {
              const share = total > 0 ? (amount / total) * 100 : 0;
              const incomeShare = income > 0 ? (amount / income) * 100 : 0;
              const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
              return (
                <div className="spending-row" key={name}>
                  <span
                    className={"category c" + (index % 5)}
                    aria-hidden="true"
                  >
                    <CategoryIcon name={name} index={index} />
                  </span>
                  <div className="spending-copy">
                    <div className="spending-label">
                      <strong>{name}</strong>
                      <div className="spending-shares">
                        <span>{Math.round(share)}% of spend</span>
                        <span className="share-sep">·</span>
                        <span>{Math.round(incomeShare)}% of income</span>
                      </div>
                    </div>
                    <div
                      className="spending-track"
                      aria-label={
                        name + ": " + Math.round(share) + "% of listed spending"
                      }
                    >
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, share))}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                  <strong className="spending-amount">{money(amount)}</strong>
                </div>
              );
            })}
          </div>
          <p className="spending-footnote">
            Category shares are based on the figures you entered. Adjust them
            below to explore another month.
          </p>
        </section>

        <div className="columns">
          <form id="profile" onSubmit={analyze}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE STARTING POINT</p>
                <h2>Your monthly picture</h2>
              </div>
              <span className="subtle-pill">KES / month</span>
            </div>

            <div className="two">
              <label className="field-card">
                <span className="field-title">Take-home income</span>
                <div className="input-affix">
                  <span className="affix">KSh</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000000000"
                    required
                    value={income}
                    onChange={(e) => {
                      setIncome(+e.target.value);
                      setActivePreset("custom");
                    }}
                  />
                </div>
                <small className="field-hint">Monthly net after PAYE, NHIF/SHIF &amp; NSSF</small>
              </label>

              <label className="field-card">
                <span className="field-title">Dependants</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  required
                  value={dependants}
                  onChange={(e) => {
                    setDependants(+e.target.value);
                    setActivePreset("custom");
                  }}
                />
                <small className="field-hint">People supported by this income</small>
              </label>
            </div>

            <div className="sub-header">
              <h3>Where your money goes</h3>
              <div className="sub-header-actions">
                {Object.keys(expenses).length < 30 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setShowAddCategory((prev) => !prev)}
                  >
                    {showAddCategory ? "Cancel" : "+ Add category"}
                  </button>
                )}
              </div>
            </div>

            {showAddCategory && (
              <div className="add-category-bar">
                <input
                  type="text"
                  maxLength={60}
                  placeholder="e.g. School fees, Chama, Black tax, Healthcare…"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleAddCategory}
                >
                  Add
                </button>
              </div>
            )}

            <div className="expenses-container">
              {Object.entries(expenses).map(([name, value], i) => {
                const isCustom = !Object.prototype.hasOwnProperty.call(
                  initialExpenses,
                  name,
                );
                return (
                  <div className="expense" key={name}>
                    <label htmlFor={name}>
                      <span
                        className={"category c" + (i % 5)}
                        aria-hidden="true"
                      >
                        <CategoryIcon name={name} index={i} />
                      </span>
                      <span className="expense-name-wrap">
                        <span>{name}</span>
                        {income > 0 && (
                          <small>{Math.round((value / income) * 100)}% of income</small>
                        )}
                      </span>
                    </label>
                    <div className="expense-input-group">
                      <div className="expense-field">
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
                          onChange={(e) => {
                            setExpenses({
                              ...expenses,
                              [name]: +e.target.value,
                            });
                            setActivePreset("custom");
                          }}
                        />
                      </div>
                      {isCustom && Object.keys(expenses).length > 1 && (
                        <button
                          type="button"
                          className="icon-remove-btn"
                          aria-label={`Remove ${name} category`}
                          onClick={() => {
                            const next = { ...expenses };
                            delete next[name];
                            setExpenses(next);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="debt-head">
              <div>
                <h3>Debts to work through</h3>
                <p className="subtle">
                  Add SACCO loans, mobile facilities, or bank balances for an
                  Avalanche vs. Snowball comparison.
                </p>
              </div>
              <button
                type="button"
                className="text-button add-debt-btn"
                disabled={debts.length >= 10}
                onClick={() => {
                  setDebts([
                    ...debts,
                    {
                      name: "Loan",
                      amount: 15000,
                      interest_rate: 18,
                      min_payment: 1500,
                    },
                  ]);
                  setActivePreset("custom");
                }}
              >
                + Add debt
              </button>
            </div>

            {debts.length === 0 && (
              <div className="empty-debts-box">
                <p className="subtle">
                  No debts added. Add a balance for a payoff strategy, or build
                  your plan debt-free.
                </p>
              </div>
            )}

            {debts.map((debt, i) => (
              <fieldset key={i} className="debt-fieldset">
                <legend>
                  <span>Debt {i + 1}</span>
                  <button
                    type="button"
                    className="text-button danger-link"
                    onClick={() => setDebts(debts.filter((_, j) => i !== j))}
                  >
                    Remove debt
                  </button>
                </legend>
                {(
                  ["name", "amount", "interest_rate", "min_payment"] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        name: "Name",
                        amount: "Balance (KES)",
                        interest_rate: "Annual interest %",
                        min_payment: "Minimum payment (KES)",
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
              </fieldset>
            ))}

            <button className="primary" disabled={busy}>
              <span>
                {busy ? "Your coach is working…" : "Build my coaching plan"}
              </span>
              <span className="primary-arrow" aria-hidden="true">
                →
              </span>
            </button>

            <p className="privacy">
              Live mode sends these inputs to Google Vertex AI. This prototype
              does not save your financial profile. Sample figures are
              synthetic; edit them to match your month.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>

          <section className="right" aria-label="How the multi-agent system works">
            <article className="coach-card">
              <div className="coach-card-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2L14.8 8.5 22 9.3l-5.5 4.7 1.7 7L12 17.3 5.8 21l1.7-7L2 9.3l7.2-.8L12 2z" />
                </svg>
                <span>GOOGLE ADK SEQUENTIAL PIPELINE</span>
              </div>
              <p className="eyebrow">THREE PERSPECTIVES. ONE PLAN.</p>
              <h2>
                A coach for every
                <br />
                part of your money.
              </h2>
              <p className="coach-lead">
                Your budget, savings, and debts work together. Each specialist
                agent passes its validated structured output directly to the
                next stage in sequence.
              </p>
              <div className="steps">
                {agentStages.map((stage, idx) => (
                  <div className="step-item" key={stage.agent}>
                    <span className="step-num">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="step-body">
                      <div className="step-title-row">
                        <h3>{stage.label}</h3>
                        <code className="step-code">{stage.stateKey}</code>
                      </div>
                      <p>{stage.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="note">
              <div className="note-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3>Honest numbers, zero silent fallbacks.</h3>
                <p>
                  Demo mode performs transparent local arithmetic without calling
                  a paid model. Live mode streams real-time Google ADK agent
                  transitions from Vertex AI.
                </p>
              </div>
            </article>

            <article className="quick-ask-card">
              <div>
                <p className="eyebrow">HAVE A SPECIFIC QUESTION?</p>
                <h3>Chat with your contextual coach</h3>
                <p>
                  Ask "What if my rent increases by KES 5,000?" or "Should I
                  clear my mobile loan before building my emergency fund?"
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn full-width"
                onClick={() => setChatOpen(true)}
              >
                Open coach conversation →
              </button>
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
              <span
                className={`pill ${
                  result.mode === "demo" ? "demo-pill" : "live-pill"
                }`}
              >
                <span className="status-indicator" aria-hidden="true" />
                {result.mode === "demo"
                  ? "Demo · no AI calls"
                  : "Live · Google ADK"}
              </span>
            )}
          </div>

          {busy ? (
            <div className="agent-progress" role="status" aria-live="polite">
              <p className="progress-intro">
                Your plan is taking shape, one specialist at a time.
              </p>
              <div className="agent-progress-grid">
                {agentProgress.map((step, index) => (
                  <div
                    className={"agent-progress-step " + step.status}
                    key={step.agent}
                  >
                    <span className="progress-marker">
                      {step.status === "done"
                        ? "✓"
                        : String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="progress-agent-tag">{step.shortName}</span>
                      <strong>{step.label}</strong>
                      <small>
                        {step.status === "done"
                          ? "Complete"
                          : step.status === "working"
                            ? "Working on your numbers…"
                            : "Next in the sequence"}
                        {step.elapsed_seconds
                          ? " · " + step.elapsed_seconds + "s"
                          : ""}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : result ? (
            <>
              <div className="tabs" role="tablist" aria-label="Specialist sections">
                {Object.keys(result.results).map((k) => {
                  const meta = tabMeta[k];
                  return (
                    <button
                      role="tab"
                      aria-selected={tab === k}
                      key={k}
                      className={tab === k ? "selected" : ""}
                      onClick={() => setTab(k)}
                    >
                      {meta ? (
                        <>
                          <span className="tab-badge">{meta.badge}</span>
                          <strong>{meta.label}</strong>
                        </>
                      ) : (
                        <strong>{k.replaceAll("_", " ")}</strong>
                      )}
                    </button>
                  );
                })}
              </div>

              <PlanRenderer
                tabKey={tab}
                data={result.results[tab]}
                mode={result.mode}
              />

              {result.trace.length > 0 && (
                <details className="trace-details">
                  <summary>Agent execution details ({result.trace.length} stages)</summary>
                  <div className="trace-list">
                    {result.trace.map((t, i) => (
                      <p key={i}>
                        <code>{t.agent}</code>
                        <span>{t.elapsed_seconds}s elapsed</span>
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <h3>Your next chapter is ready when you are.</h3>
              <p>
                Review your monthly KES income, expenses, and optional debts
                above, then select <strong>Build my coaching plan</strong> to run
                the three-specialist sequence.
              </p>
            </div>
          )}
        </section>

        <footer>
          <div>
            <strong>Steady</strong> · Built for a more intentional financial life
            in Kenya.
          </div>
          <span>
            Educational guidance in KES. Review AI-generated figures before
            acting.
          </span>
        </footer>
      </main>

      {chatOpen && (
        <>
          <button
            className="chat-backdrop"
            aria-label="Close money coach chat"
            onClick={() => setChatOpen(false)}
          />
          <section
            className="chat-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable =
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), textarea, input, [tabindex]:not([tabindex='-1'])",
                );
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <div className="chat-header">
              <div className="chat-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" />
                </svg>
              </div>
              <div className="chat-header-copy">
                <h2 id="chat-title">Your money coach</h2>
                <p>
                  {chatMode === "live"
                    ? "Google ADK · Vertex AI"
                    : chatMode === "demo"
                      ? "Demo mode · AI not connected"
                      : "Kenya · KES context attached"}
                </p>
              </div>
              <button
                type="button"
                className="chat-close"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            <div className="chat-context-strip">
              <span>Context synced:</span>
              <strong>{money(income)} income</strong>
              <span>·</span>
              <strong>{money(total)} spend</strong>
              <span>·</span>
              <strong>{debts.length} debt(s)</strong>
            </div>

            <div
              className="chat-transcript"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {chatMessages.length === 0 && (
                <div className="chat-welcome">
                  <span className="eyebrow">A CLEARER NEXT STEP</span>
                  <p>
                    Ask about your budget, savings, or a debt strategy. Your
                    current KES figures are included for context.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void sendChat(
                        "How much room do I have after my monthly expenses?",
                      )
                    }
                  >
                    <span>How much is left after expenses?</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void sendChat(
                        "How could I make a plan for my debt repayments?",
                      )
                    }
                  >
                    <span>Help me plan debt repayments</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void sendChat(
                        "How much emergency fund should I aim for in KES?",
                      )
                    }
                  >
                    <span>How big should my emergency fund be?</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              )}

              {chatMessages.map((message, index) => (
                <div
                  className={`chat-message ${message.role}`}
                  key={`${index}-${message.role}`}
                >
                  <span>
                    {message.role === "assistant" ? "Coach" : "You"}
                    {message.mode === "demo" ? " · Demo" : ""}
                  </span>
                  <p>{plainText(message.content)}</p>
                </div>
              ))}

              {chatBusy && (
                <p className="chat-thinking" role="status">
                  Your coach is thinking…
                </p>
              )}
              {chatError && (
                <p className="error" role="alert">
                  {chatError}
                </p>
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              className="chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat();
              }}
            >
              <label className="sr-only" htmlFor="chat-input">
                Message your money coach
              </label>
              <textarea
                ref={chatInputRef}
                id="chat-input"
                rows={2}
                maxLength={1200}
                placeholder="Ask about your monthly plan…"
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendChat();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!chatText.trim() || chatBusy}
                aria-label="Send message"
              >
                ↑
              </button>
              <small>
                Never share PINs or account numbers. Guidance is educational.
              </small>
            </form>
          </section>
        </>
      )}

      <nav className="mobile-nav" aria-label="Primary navigation">
        <a href="#overview" onClick={() => setActiveSection("overview")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          Home
        </a>
        <a href="#spending" onClick={() => setActiveSection("spending")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 10h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
          Spending
        </a>
        <a href="#analysis" onClick={() => setActiveSection("analysis")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Your plan
        </a>
      </nav>

      <button
        type="button"
        className="chat-fab"
        onClick={() => setChatOpen(true)}
        aria-expanded={chatOpen}
        aria-label="Open money coach chat"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" />
        </svg>
        <span>Ask your coach</span>
      </button>
    </div>
  );
}
