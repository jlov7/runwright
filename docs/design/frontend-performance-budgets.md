# Frontend Performance Budgets

Date: 2026-02-19

## Budget targets
- HTML shell size (`apps/web/index.html`): <= 70 KB
- CSS shell size (`apps/web/styles.css`): <= 45 KB
- Combined shell size: <= 110 KB
- Average file-read sampling (10 iterations): <= 5 ms per file

## Guard commands
- `pnpm perf:frontend:check`
- `pnpm perf:frontend:soak`

## CI enforcement
- CI performance job executes `pnpm perf:frontend:check` and `pnpm perf:frontend:soak`.
- Reports are published in `reports/performance/frontend-budget.report.json` and `reports/performance/frontend-budget.soak.json`.

## Related runtime UX guardrails
- Dev latency budget alerts are surfaced in-app when API interactions exceed 1200ms.
- Retry queue backoff protects interaction responsiveness under transient network failures.
