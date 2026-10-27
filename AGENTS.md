# Development instructions
Read README.md and docs/architecture.md before editing. Preserve upstream attribution. Keep credentials out of source control and the browser. Run npm run typecheck and npm run build for frontend changes; run uv run --locked python -m unittest discover -s tests -v from backend for Python changes. Never turn failed live analysis into unlabeled demo output. Preserve the three-agent dependency order.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
