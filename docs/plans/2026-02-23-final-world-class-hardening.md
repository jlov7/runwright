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
- [x] M1 complete
- [x] M2 complete
- [x] M3 complete
- [x] M4 complete
- [x] M5 complete

## Milestone Notes
- M1 (2026-02-23):
  - Added Playwright browser matrix + runtime journey suite (`playwright.config.ts`, `tests/browser/frontend-runtime.spec.ts`).
  - Added browser regression scripts (`test:web:browser`, `test:web:browser:baseline`) and dependencies.
  - Added committed cross-browser screenshot baselines in `tests/browser/__screenshots__/`.
  - Fixed overlay rendering defect where hidden dialogs still intercepted input by enforcing `[hidden] { display: none !important; }`.
  - Validation evidence:
    - `pnpm test:web:browser:baseline`
    - `pnpm test:web:browser`
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm test`
    - `pnpm build`
- M2 (2026-02-23):
  - Closed runtime state-store migration TODO by extracting default runtime state creation into `apps/web/state-store.js` and wiring `apps/web/app.js` to use `createRuntimeState()`.
  - Added runtime state-store typing contract in `apps/web/state-store.d.ts`.
  - Added regression coverage for runtime store defaults/isolation in `tests/frontend-runtime-state-store.test.ts`.
  - Validation evidence:
    - `pnpm vitest run tests/frontend-runtime-state-store.test.ts tests/game-runtime-shell.test.ts`
    - `pnpm verify`
- M3 (2026-02-23):
  - Added runtime observability primitives in `src/game/runtime.ts`: `x-request-id` response headers, structured error envelopes with `requestId` and `occurredAt`, and `/v1/metrics` endpoint with endpoint-level latency p50/p95 summaries.
  - Added deterministic backend bootstrap route `POST /v1/demo/bootstrap` and wired frontend onboarding bootstrap action to consume it from `apps/web/app.js`.
  - Expanded resilience coverage with runtime restart persistence and retry-idempotency checks (`tests/game-runtime-resilience.test.ts`) plus runtime observability/bootstrap assertions in `tests/game-runtime.test.ts`.
  - Validation evidence:
    - `pnpm vitest run tests/game-runtime.test.ts tests/game-runtime-security-hardening.test.ts tests/game-runtime-resilience.test.ts tests/game-runtime-shell.test.ts`
    - `pnpm verify`
    - `pnpm test:web:browser`
- M4 (2026-02-23):
  - Added enforceable runtime SLO gate script `scripts/check_runtime_slo.ts` (`pnpm runtime:slo:check`) with pass/fail test coverage in `tests/runtime-slo-script.test.ts`.
  - Added runtime API compatibility governance and checks:
    - Runtime API version metadata + header in `src/game/runtime.ts` (`GET /v1/meta/version`, `x-runwright-api-version`).
    - Compatibility gate script `scripts/check_runtime_api_compatibility.ts` (`pnpm api:compat:runtime`) with tests in `tests/runtime-api-compat-script.test.ts`.
    - Governance doc `docs/release/runtime-api-versioning-policy.md`.
  - Added automated frontend copy/interaction consistency QA script `scripts/check_frontend_copy_consistency.ts` (`pnpm qa:copy:check`) with tests in `tests/frontend-copy-consistency-script.test.ts`.
  - Updated release gates and SLO policy docs (`docs/release/RELEASE_GATES.md`, `docs/release/runtime-slo-policy.md`).
  - Validation evidence:
    - `pnpm vitest run tests/game-runtime.test.ts tests/game-runtime-security-hardening.test.ts tests/runtime-slo-script.test.ts tests/runtime-api-compat-script.test.ts tests/frontend-copy-consistency-script.test.ts`
    - `pnpm verify`
- M5 (2026-02-23):
  - Final convergence gates executed and green:
    - `pnpm verify`
    - `pnpm run doctor` -> `reports/doctor/doctor.json` (`generatedAt: 2026-02-23T14:40:00.145Z`, `overall.ok: true`)
    - `pnpm run quality:evidence:verify` -> `reports/quality/evidence-verification.json` (`ok: true`)
    - `pnpm ship:gate` -> `reports/quality/ship-gate.summary.json` (`generatedAt: 2026-02-23T14:37:53.569Z`, `overall.ok: true`)
    - `pnpm runtime:slo:check` -> `reports/quality/runtime-slo.report.json` (`ok: true`)
    - `pnpm api:compat:runtime` -> `reports/quality/runtime-api-compat.report.json` (`ok: true`)
    - `pnpm qa:copy:check` -> `reports/quality/frontend-copy-consistency.report.json` (`ok: true`)

## Evidence Artifacts
- Browser visual/e2e outputs: `reports/frontend/browser/`
- Runtime SLO report: `reports/quality/runtime-slo.report.json`
- Doctor report: `reports/doctor/doctor.json`
- Ship gate summary: `reports/quality/ship-gate.summary.json`
