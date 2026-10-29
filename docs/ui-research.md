# Interface research and design decisions

Research snapshot: 29 October 2026

## Patterns observed

- Safaricom's M-PESA app manual gives spending its own navigation destination and presents monthly category summaries. That makes spending an easy-to-find task, rather than a secondary detail inside account settings. [M-PESA App Manual](https://www.safaricom.co.ke/images/Downloads/M-PESA_App_Manual.pdf)
- PesaSense uses category budgets and clear progress colors to show when spending is nearing a limit. Steady currently collects category totals but has no per-category limits, so its chart uses each category's share of the entered monthly total instead of implying a budget target. [PesaSense](https://pesasense.co.ke/)
- Monzo's budgeting guidance emphasizes category trends, a pace check, and available-to-spend context. Steady follows the same hierarchy with take-home income, expense total, remaining balance, then the category map. [Monzo: cost of living support](https://monzo.com/blog/cost-of-living-how-were-supporting)
- YNAB makes goals and progress visible in focused views. Steady gives the coaching plan its own section and names the three specialists so users can follow the order of work. [YNAB features](https://www.ynab.com/features) · [YNAB goal tracking](https://www.ynab.com/features/goal-tracking)

## Decisions in Steady

- Keep KES as the display currency and use Kenyan English and locally familiar examples already present in the product.
- Place the spending map directly below the headline monthly balances; sort it by the largest entered category and show both its KES amount and percentage share.
- Add a compact mobile navigation for Home, Spending, and Your plan; keep the money coach reachable from its floating action button.
- Stream only real ADK events. In live mode each sequential specialist moves from waiting to working to complete; demo mode returns its labeled calculation without fabricated agent activity.
- Ask the assistant for readable plain text and remove common Markdown markers from legacy responses before displaying them.

The reference products informed placement and interaction patterns. Steady uses its own code, palette, copy, and visual treatment. Its spending chart reflects only figures manually entered by the user; it is not connected to M-PESA or a bank account and does not infer category spending limits.
