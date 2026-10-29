# Development instructions
Read README.md and docs/architecture.md before editing. Preserve upstream attribution. Keep credentials out of source control and the browser. Run npm run typecheck and npm run build for frontend changes; run uv run --locked python -m unittest discover -s tests -v from backend for Python changes. Never turn failed live analysis into unlabeled demo output. Preserve the three-agent dependency order.


## Antigravity and AI coding workflow

Google Antigravity reads repository `AGENTS.md` and `GEMINI.md` rules. Use this file as the project's shared instructions; do not create a duplicate global rule for this repository.

The owner authorizes local source and documentation edits, local dev servers on loopback, and the checks listed below without asking for permission each time. Before editing, inspect `git status --short --branch`, read `README.md` and `docs/architecture.md`, and preserve every pre-existing edit, untracked file, and generated change. Read `docs/ui-research.md` for UI work and `docs/deployment.md` for deployment work. For this complete source repository, inspect source files normally; follow `docs/rea-agent-guide.md` only when the task actually involves a compiled app, bundle, capture, or live runtime that needs REA evidence.

### Project constraints

- The web app is Next.js 16 on Vercel; agent orchestration stays in Python Google ADK. Preserve the three specialists' sequential dependency order and the separate contextual chat agent.
- Keep Kenyan localization and KES. Use synthetic financial values in examples and tests.
- Keep demo responses explicitly labeled. Never hide a live backend or Vertex error by returning a demo result.
- Keep Google credentials, app tokens, `.env.local`, `backend/.env`, and `.vercel/` data private. Never print secret values, overwrite an existing local env file, add secrets to Git, or expose credentials to browser code.
- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before changing Next.js code. Follow the current installed version's APIs.

### Local development

From the repository root, install locked dependencies with `npm ci`. In `backend/`, run `uv sync --locked`. Create `.env.local` from `.env.example` and `backend/.env` from `backend/.env.example` only when the destination does not already exist. The example configuration uses demo mode and does not call a paid model.

Run the Python service in one terminal:

```powershell
Set-Location backend
uv run --locked uvicorn main:app --host 127.0.0.1 --port 8080
```

Run Next.js from the repository root in another terminal:

```powershell
npm run dev
```

Use `http://127.0.0.1:3001` for local browser checks. Keep development services bound to loopback; do not expose them to the LAN or public internet.

### Verification and external services

For frontend changes, run `npm run typecheck` and `npm run build`. For Python changes, run `uv run --locked python -m unittest discover -s tests -v` from `backend/`. These checks do not call paid models.

For a task that explicitly requests live Vertex verification, the owner authorizes one analysis request and one chat request using synthetic values in `operating-ethos-513011-c0`; live requests may consume Google Cloud credits. Never send real personal financial data. Do not change cloud IAM, secrets, Vercel environment variables, deployment protection, or deploy, push, or merge changes unless the task explicitly asks for that action.
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
