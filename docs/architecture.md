# Architecture decisions

## Preserve Python ADK
The source project uses Google ADK, not OpenAI Agents SDK or Vercel AI SDK. The frontend is Next.js on Vercel; orchestration remains Python. Adding a second orchestration SDK would duplicate ownership without helping the current use case.

## Sequential orchestration
Budget output is injected into the savings prompt. Budget and savings outputs are injected into the debt prompt. Sequential execution is appropriate because later steps depend on earlier results. Independent parallel execution would break those dependencies.

## Typed boundaries
Pydantic validates nonnegative finite amounts, bounded dependants, debt rates, and collection sizes. Agent outputs are checked against the original output schemas. Missing or malformed results cause an explicit error, never a plausible invented fallback.

## Ephemeral sessions
Each request has unique user and session IDs. Sessions are deleted in a finally block. This isolates requests but does not provide persistent history. Trace output contains agent names and elapsed timings, not private reasoning.

## Deployment boundary
A Next.js server route keeps the backend token out of the browser. Vertex AI credentials remain in Python via ADC locally and a service identity on Cloud Run. A shared backend token supports a protected prototype, but does not replace end-user authentication or rate limiting. Keep the Vercel deployment access-protected until those exist.

## Evaluation roadmap
Current tests cover validation, demo arithmetic, authentication, and agent dependency structure. Before claiming model quality, add synthetic evaluation cases for deficit budgets, zero income, no debts, unaffordable minimum payments, and competing goals. Validate debt figures using a deterministic amortization tool. Do not describe existing model-generated forecasts as verified financial mathematics.


## SDK compatibility
ADK 2.13 supports this implementation but deprecates SequentialAgent in favor of Workflow. The dependency lock preserves the tested version. Migrate with behavioral tests in a future change; the original orchestration is retained for this adaptation.
