type ProfileInput = {
  monthly_income: number;
  manual_expenses: Record<string, number>;
  debts: { amount: number }[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProfile(value: unknown): ProfileInput {
  if (!record(value)) throw new Error("Invalid profile");

  const income = value.monthly_income;
  const expenses = value.manual_expenses;
  const debtsValue = value.debts ?? [];

  if (
    typeof income !== "number" ||
    !Number.isFinite(income) ||
    income < 0 ||
    income > 1e10 ||
    !record(expenses) ||
    Object.keys(expenses).length > 30 ||
    !Array.isArray(debtsValue) ||
    debtsValue.length > 10
  ) {
    throw new Error("Invalid profile");
  }

  const manualExpenses: Record<string, number> = {};
  for (const [category, amount] of Object.entries(expenses)) {
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1e10
    ) {
      throw new Error("Invalid profile");
    }
    manualExpenses[category] = amount;
  }

  const debts = debtsValue.map((debt) => {
    if (
      !record(debt) ||
      typeof debt.amount !== "number" ||
      !Number.isFinite(debt.amount) ||
      debt.amount < 0 ||
      debt.amount > 1e10
    ) {
      throw new Error("Invalid profile");
    }
    return { amount: debt.amount };
  });

  return {
    monthly_income: income,
    manual_expenses: manualExpenses,
    debts,
  };
}

export function demoAnalysis(value: unknown) {
  const profile = parseProfile(value);
  const expenses = Math.round(
    Object.values(profile.manual_expenses).reduce((sum, amount) => sum + amount, 0) * 100,
  ) / 100;
  const debt = profile.debts.reduce((sum, item) => sum + item.amount, 0);

  return {
    mode: "demo",
    summary: {
      income: profile.monthly_income,
      expenses,
      remaining: Math.round((profile.monthly_income - expenses) * 100) / 100,
      debt,
    },
    trace: [],
    results: {
      budget_analysis: {
        note: "Production demo calculation only. Connect the protected preview to Vertex AI for personalized analysis.",
        spending_categories: Object.entries(profile.manual_expenses).map(
          ([category, amount]) => ({ category, amount }),
        ),
      },
      savings_strategy: {
        note: "A six-month expense illustration; this is not an AI recommendation.",
        illustrative_emergency_fund: expenses * 6,
      },
      debt_reduction: {
        note: "Live analysis compares avalanche and snowball strategies. No payoff forecast is fabricated in demo mode.",
        total_debt: debt,
      },
    },
  };
}

export function demoChat(value: unknown) {
  if (!record(value) || typeof value.message !== "string" || !value.message.trim()) {
    throw new Error("Invalid chat request");
  }
  const profile = parseProfile(value.profile);
  const expenses = Math.round(
    Object.values(profile.manual_expenses).reduce((sum, amount) => sum + amount, 0) * 100,
  ) / 100;
  const remaining = Math.round((profile.monthly_income - expenses) * 100) / 100;

  return {
    mode: "demo",
    reply:
      "Demo mode — AI chat is not connected on the public production site. From the numbers currently entered, " +
      `your listed income is KES ${profile.monthly_income.toLocaleString("en-KE")} and your expenses total ${expenses.toLocaleString("en-KE")}, leaving KES ${remaining.toLocaleString("en-KE")} before savings and debt payments. ` +
      "Use the protected Vercel preview to try the live Google ADK coach.",
    trace: [],
  };
}