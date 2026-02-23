# Final World-class Hardening Program (2026-02-23)

## Purpose
Close the remaining pre-release quality gaps that separate “release-ready” from “world-class” across frontend UX, backend reliability, observability, and launch governance.

## Scope
- Frontend web runtime UX quality and verification depth.
- Backend runtime observability, resilience, and API lifecycle governance.
- Release gates and SLO evidence.

## Ten Must-complete Items
1. Replace hash-only visual checks with real rendered screenshot regression and browser matrix support.
2. Add real browser E2E journeys for first visit, returning user, onboarding completion, and error recovery.
3. Add runtime accessibility audits (axe + keyboard flow assertions).
4. Complete frontend state-store migration TODOs by wiring a runtime store path.
5. Add production-grade observability: request IDs, structured errors, endpoint latency distribution, and metrics route.
6. Add deterministic demo mode bootstrap flow for guided product demonstrations.
7. Expand backend resilience tests (restart, reconnect/retry behavior, and idempotency).
8. Add explicit runtime SLO policy and enforceable gate check script.
9. Add API contract versioning governance and compatibility checks.
10. Complete copy/interaction consistency QA with automated regression checks.

## Milestones
- M1: Visual + E2E + accessibility browser testing stack (items 1-3).
- M2: Frontend runtime store migration and cleanup (item 4).
- M3: Observability + demo mode + resilience (items 5-7).
- M4: SLO gate + API versioning + copy QA (items 8-10).
- M5: Full verification + release evidence refresh.

## Validation Gates
- Per milestone:
  - `pnpm lint`
  - `pnpm typecheck`
  - targeted suites for touched areas
  - `pnpm build`
- Final:
  - `pnpm verify`
  - `pnpm run doctor`
  - `pnpm quality:evidence:verify`
  - `pnpm ship:gate`

## Progress
- [ ] M1 complete
- [ ] M2 complete
- [ ] M3 complete
- [ ] M4 complete
- [ ] M5 complete

## Evidence Artifacts
- Browser visual/e2e outputs: `reports/frontend/browser/`
- Runtime SLO report: `reports/quality/runtime-slo.report.json`
- Doctor report: `reports/doctor/doctor.json`
- Ship gate summary: `reports/quality/ship-gate.summary.json`
