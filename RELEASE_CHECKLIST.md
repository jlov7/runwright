# Release Checklist (v1)

## Core Journeys
- [x] Happy-path user journeys are coherent end-to-end.
- [x] Key failure states are handled with clear recovery guidance.
- [x] User-facing copy is clear and actionable.

## Onboarding
- [x] First-run onboarding is implemented.
- [x] Empty states are implemented.
- [x] Progressive disclosure is implemented (clear next action).

## Help
- [x] In-app help/tooltips are implemented (CLI help/journey guidance).
- [x] Minimal docs/help page exists and is linked from primary docs.

## Quality Gates
- [x] Critical logic has automated tests.
- [x] Key UX flows have automated tests.
- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] CI requirement is satisfied (required checks green or RG-007 exception path fully evidenced).

## Accessibility Basics
- [x] Primary flows are keyboard-only navigable (CLI-first interactions).
- [x] Focus/interaction affordances are sensible for terminal usage.
- [x] Labels/aria equivalent clarity exists in CLI output and docs where relevant.

## Performance Basics
- [x] No obvious slow user-facing flows.
- [x] Unnecessary rework/re-renders avoided in current architecture.
- [x] Bundle/runtime footprint remains reasonable for stack.

## Security Hygiene
- [x] No secrets are committed to repository history for this release work.
- [x] Inputs are validated at command boundaries.
- [x] Error handling remains safe and actionable.
- [x] Auth/signing boundaries are respected where applicable.

## Documentation
- [x] README includes local setup instructions.
- [x] README includes run commands.
- [x] README includes test/verification commands.
- [x] README includes deploy/release notes.
- [x] README includes required/optional environment variables.

## Latest Evidence (2026-02-20)
- [x] Exhaustive launch sweep executed on `2026-02-20` with fresh passes for `pnpm verify`, `pnpm run doctor` (`reports/doctor/doctor.json` generated `2026-02-20T20:14:23.907Z`), `pnpm ship:gate` (`reports/quality/ship-gate.summary.json` generated `2026-02-20T20:22:09.730Z`, `overall.ok: true`), `pnpm quality:evidence:verify`, `pnpm release:verify-local`, `pnpm test:web-a11y`, `pnpm test:visual`, `pnpm perf:frontend:check`, `pnpm perf:frontend:soak`, `pnpm qa:frontend:matrix`, `pnpm test:coverage`, `pnpm test:fuzz-differential`, `pnpm test:mutation`, and `pnpm ship:soak` (`reports/quality/soak/ship-gate-soak.report.json` generated `2026-02-20T20:26:15.926Z`).
- [x] Live runtime smoke checks passed against real server (`/v1/health`, `/v1/help`, `/v1/release/readiness`) via direct API probes.
- [x] Runtime browser security hardening shipped: same-origin origin/CSRF checks, defensive security headers, endpoint rate limits, and profile-scoped session boundary enforcement in `/v1` mutation routes (`src/game/runtime.ts`).
- [x] Browser clients now attach CSRF intent headers on mutating runtime calls (`apps/web/index.html`, `apps/web/src/shared/api-client.ts`).
- [x] Web onboarding now establishes a runtime auth session and propagates `x-session-id` for mutating calls, tightening auth boundaries during core loop actions (`apps/web/index.html`).
- [x] Profile surface now exposes explicit session logout UX so auth sessions can be ended in-app without CLI/manual state edits (`apps/web/index.html`).
- [x] Runtime security regression coverage added: `tests/game-runtime-security-hardening.test.ts` verifies origin/CSRF rejection, rate limiting, session/profile mismatch rejection, and baseline security headers.
- [x] Frontend visual baseline refreshed after runtime shell request-header changes (`tests/fixtures/frontend-visual-baseline.json`).
- [x] Frontend shell budget guard remains enforced with updated target (`<= 72 KB` HTML) and passing regression coverage (`scripts/check_frontend_performance.ts`, `tests/frontend-performance-script.test.ts`, `docs/design/frontend-performance-budgets.md`).
- [x] Fresh gate reruns on this increment succeeded: `pnpm verify`, `pnpm run doctor`, `pnpm ship:gate -- --skip mutation --skip fuzz-differential`, and `pnpm tsx scripts/verify_quality_evidence.ts --require-check verify --require-check audit --require-check sbom --require-check release-verify-local`.
- [x] Frontend 100/100 program closure completed on `2026-02-19` with M5-M9 tasks implemented and evidenced in `docs/plans/2026-02-19-frontend-100-score-execution-plan.md` and `docs/release/frontend-release-dashboard.md`.
- [x] Added CI-enforced frontend quality gates: `pnpm test:web-a11y`, `pnpm test:visual`, `pnpm test:coverage`, `pnpm perf:frontend:check`, and `pnpm qa:frontend:matrix`.
- [x] Added runtime-backed frontend journey/contract/failure coverage: `tests/frontend-journey-e2e.test.ts`, `tests/frontend-runtime-contract.test.ts`, `tests/game-runtime-failure-injection.test.ts`.
- [x] Runtime foundation is now real (not simulated only): `src/game/contracts.ts`, `src/game/runtime-store.ts`, `src/game/runtime.ts`, `scripts/game_runtime.ts`, and `apps/web/` ship a launchable web/runtime stack.
- [x] Runtime/web journey coverage added and passing: `tests/game-runtime.test.ts`, `tests/game-runtime-shell.test.ts`, `tests/game-runtime-script.test.ts`.
- [x] CLI client-readiness now checks real runtime assets (`src/cli.ts`) with integration coverage in `tests/cli.integration.test.ts`.
- [x] Fresh full gate pass: `pnpm verify` (343/343 tests passing, build green).
- [x] Fresh doctor evidence: `pnpm run doctor` -> `reports/doctor/doctor.json` generated `2026-02-17T18:39:35.630Z`.
- [x] Fresh quality evidence verification: `pnpm quality:evidence:verify` -> `reports/quality/evidence-verification.json`.
- [x] Fresh ship gate evidence: `pnpm ship:gate` -> `reports/quality/ship-gate.summary.json` generated `2026-02-17T18:42:25.973Z`, `overall.ok: true`.
- [x] RG-007 platform incident exception documented with repeated recent-run evidence: sample `CI`/`CodeQL` pairs `22109118266`/`22109118280`, `22110929744`/`22110929736`, `22111146887`/`22111146880`, `22112492942`/`22112492922`, `22112524863`/`22112524890`, and latest `22203952764`/`22203952755` all failed because GitHub Actions jobs were not started due to account billing/spending-limit restrictions (`stepsCount: 0` across failing jobs); incident evidence recorded in `QUESTIONS.md` and `GAPS.md`.
- [x] CI/CodeQL rerun on latest head (`a57fff9`) confirms unchanged startup-failure mode: `CI` `22240155561` and `CodeQL` `22240155541` both completed as failure with `stepsCount: 0` across failing jobs, so RG-007 exception remains active with fresh compensating local evidence.
- [x] CI/CodeQL rerun on latest head (`8b54389`) confirms unchanged startup-failure mode: `CI` `22240196616` and `CodeQL` `22240196630` both completed as failure with `stepsCount: 0` across failing jobs, so RG-007 exception remains active with fresh compensating local evidence.
- [x] Required RG-007 compensating local command passed on latest head: `pnpm release:verify-local` (`release artifact verification: ok`).
- [x] Latest ship gate run is green: `pnpm ship:gate` (`reports/quality/ship-gate.summary.json` generated `2026-02-17T14:56:40.649Z`, `overall.ok: true`).
- [x] Final convergence gate is green: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, and `pnpm ship:gate` all passed in sequence on `2026-02-17`.
- [x] Pre-release world-class program shipped: 35 readiness features implemented and tracked in `docs/plans/2026-02-16-world-class-game-pre-release-program.md`.
- [x] Gameplay now includes release-readiness modes (`client`, `profile`, `sync`, `tutorial`, `recovery`, `social`, `moderation`, `telemetry`, `crash`, `accessibility`, `localization`, `qa`, `launch`) plus existing progression modes.
- [x] Gameplay feature suite shipped with twelve new modes under `runwright gameplay` (`quest`, `campaign`, `boss`, `ghost`, `director`, `coop`, `challenge`, `skilltree`, `liveops`, `creator`, `cinematic`, `ranked`) and integration coverage.
- [x] Legacy triple-feature backlog was revalidated and closed with targeted workstream tests (`199/199` passing across manifest/lockfile/trust/resolver/policy/workflow/CLI integration suites).
- [x] Session replay analytics shipped with integration coverage: `runwright analytics journey --json` (funnel metrics, recovery replay, persona scorecard) in `tests/cli.integration.test.ts`.
- [x] Signup/onboarding/first-success/core-loop/error journeys were audited and UX copy/help hints were improved in `src/cli.ts`.
- [x] Lightweight UX tests were updated for touched journeys in `tests/journey-ux.test.ts`, `tests/help-ux.test.ts`, and `tests/error-guidance-ux.test.ts`.
- [x] Verification commands passed: `pnpm vitest run tests/journey-ux.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts`, `pnpm vitest run tests/cli.integration.test.ts`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm run doctor`.
- [x] Deep multi-persona product + backend scorecards were completed and recorded in `docs/audits/2026-02-14-product-and-backend-scorecard.md`.
- [x] Latest local gate reruns are green: `pnpm verify` (322/322 tests) and `pnpm run doctor` (`reports/doctor/doctor.json` generated `2026-02-17T14:53:49.568Z`, `overall.ok: true`).
- [x] `pnpm quality:evidence:verify` now works without manual CLI arguments and is covered by script tests.
- [x] Onboarding journey step 2 now emits a copy-paste-safe skill scaffolding command (`skills/example-skill`) with regression coverage in `tests/journey-ux.test.ts`.
- [x] `scripts/verify_quality_evidence.ts` now fails fast on unknown flags and missing flag values with explicit messages; coverage added in `tests/quality-evidence-script.test.ts`.
- [x] `scripts/doctor.ts` now rejects unknown/malformed arguments with explicit errors; coverage added in `tests/doctor-script.test.ts`.
- [x] `runwright export --deterministic` now succeeds without env var across timezones via ZIP-safe timestamp clamping; edge cases are covered in `tests/cli.integration.test.ts`.
- [x] Journey optional verify-bundle guidance now expires on project changes and surfaces rerun guidance with coverage in `tests/journey-ux.test.ts`.
- [x] Release policy defaults are now explicit in `QUESTIONS.md` (GitHub artifacts required for v1, ed25519 signatures required for production releases).
- [x] `runwright init` is now idempotent-success on repeat runs with clear next-step copy and event mutating accuracy coverage in `tests/cli.integration.test.ts`.
- [x] Release scripts now support explicit help UX (`--help`/`-h`) for operator self-service in `scripts/doctor.ts` and `scripts/verify_quality_evidence.ts`, with tests.
- [x] `runwright watch` now supports continuous drift monitoring with `--once`, debounce controls, and `--apply-safe`, with integration tests in `tests/cli.integration.test.ts`.
- [x] Release provenance now includes signed local attestation generate/verify scripts (`release:attestation:generate`, `release:attestation:verify`), schema contracts, workflow integration, and tamper-detection tests.
- [x] CI platform-incident fallback policy is now formally defined and resolved in `QUESTIONS.md` and `RELEASE_GATES.md` (default: latest-head green CI; exception: strict RG-007 evidence path only).
