# ExecPlan: Final World-class Hardening (2026-02-23)

## Purpose / Big Picture
Execute the final high-impact enhancements before release so the product is not only functional and verified, but demonstrably world-class in UX rigor, backend reliability, and release governance.

## Approach
- Implement all ten required hardening items in strict milestones with evidence artifacts.
- Keep changes reviewable and commit per logical milestone.
- Preserve existing v1 gate stability while extending verification depth.

## Progress
- [x] M1: Browser visual regression + E2E + runtime a11y audits.
- [x] M2: Frontend state-store migration completion.
- [x] M3: Runtime observability + demo mode + resilience tests.
- [ ] M4: SLO gate + API versioning + copy QA automation.
- [ ] M5: Full release verification and evidence refresh.

## Validation Gates
- Per milestone: `pnpm lint`, `pnpm typecheck`, targeted tests, `pnpm build`.
- Final: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.

## Surprises & Discoveries
- `welcome-overlay`/`explore-hub` used `hidden` attributes but CSS display rules allowed hidden overlays to still capture input in runtime browser tests; fixed with explicit global `[hidden]` enforcement in `apps/web/styles.css`.
- Browser-level onboarding and keyboard flows are now deterministic across Chromium/Firefox/WebKit with committed screenshot baselines and axe critical-violation assertions.
- Runtime state initialization is now centralized in `apps/web/state-store.js` with explicit declaration typing in `apps/web/state-store.d.ts`, removing the remaining migration TODO in `apps/web/app.js`.
- Runtime now emits structured request-correlation data (`x-request-id` headers + error payload `requestId`) and exposes in-process endpoint latency distributions via `GET /v1/metrics`.
- Deterministic demo bootstrap moved from frontend-only simulation into backend route `POST /v1/demo/bootstrap`, enabling restart-safe idempotent seeded demos.

## Decision Log
- 2026-02-23: Prioritize adding missing verification depth (browser runtime checks + SLO gates) before additional UX feature work.

## Outcomes & Retrospective
- In progress.

# ExecPlan: Frontend Deep UX Overhaul (2026-02-23)

## Purpose / Big Picture
Raise the web frontend from release-capable to world-class usability by reducing cognitive load, strengthening onboarding progression, hardening interaction/a11y behavior, and improving maintainability confidence with explicit regression coverage.

## Approach
- Run a strict gap loop with evidence-first execution.
- Work in small increments (<= 5 files per change).
- Verify after each milestone (`pnpm lint`, `pnpm typecheck`, targeted tests, `pnpm build`).
- Keep behavior changes test-backed before marking gaps complete.

## Scope
- Frontend shell only (`apps/web/*`, frontend tests, release evidence docs).
- No backend contract refactors unless required for journey correctness.

## Milestones
- M0: Tracking artifacts + refreshed gap backlog.
- M1: IA simplification and guided onboarding clarity.
- M2: Interaction reliability and recovery UX hardening.
- M3: Accessibility, modal mechanics, and mobile safe-area polish.
- M4: Visual hierarchy and contextual help improvements.
- M5: Code-structure extraction and typed model adoption where safe.
- M6: Full verification sweep + release evidence refresh.

## Validation Gates
- Per milestone:
  - `pnpm lint`
  - `pnpm typecheck`
  - targeted frontend suites
  - `pnpm build`
- Final:
  - `pnpm verify`
  - `pnpm run doctor`
  - `pnpm ship:gate`

## Progress
- [x] M0: Tracking artifacts + backlog refresh.
- [x] M1: IA simplification and guided onboarding clarity.
- [x] M2: Interaction reliability and recovery UX hardening.
- [x] M3: Accessibility, modal mechanics, and mobile safe-area polish.
- [x] M4: Visual hierarchy and contextual help improvements.
- [x] M5: Code-structure extraction and typed model adoption where safe.
- [x] M6: Full verification sweep + release evidence refresh.

## Surprises & Discoveries
- Frontend shell has strong baseline UX scaffolding, but runtime behavior still concentrates too much orchestration in `apps/web/app.js`.
- Existing a11y/visual tests are mostly static-assertion guards and do not validate runtime keyboard/modal flows deeply.

## Decision Log
- 2026-02-23: Prioritize user journey coherence and recovery clarity over large architectural rewrites in the first pass.
- 2026-02-23: Keep advanced workflows available but progressively disclosed behind clearer mode framing.

## Outcomes & Retrospective
- Done:
  - Added mode-driven IA (`Setup`, `Operate`, `Analyze`) with a mode-level primary CTA and progressive disclosure.
  - Hardened overlays with focus trap/return, escape behavior, backdrop click handling, and scroll lock.
  - Improved a11y with focus-ring token fix, field-level form aria semantics, and strengthened landmark/state markup.
  - Added mobile safe-area support and stronger mobile CTA ergonomics.
  - Standardized loading/empty/error guidance and introduced inline contextual help for critical actions.
  - Extracted shared runtime interaction + feedback logic into dedicated modules with declaration files and tests.
  - Refreshed visual baseline and passed full verification gates (`verify`, `doctor`, `quality:evidence:verify`, `ship:gate`).
- Not done:
  - None in this tracked deep frontend overhaul scope.

# ExecPlan: Release-ready v1

## Purpose / Big Picture
Runwright already has strong policy, testing, and release-integrity foundations. This plan closes remaining v1 launch gaps by tightening onboarding/help UX, formalizing release governance artifacts, and proving the full quality gate flow with fresh evidence.

## Approach
- Work in small milestones with low-risk edits.
- Prefer test-first for behavior changes.
- Keep each increment under 5 files.
- Run `pnpm verify` after each milestone and fix issues immediately.
- Run `pnpm ship:gate` before final release report.

## Files In Scope (initial)
- `AGENTS.md`
- `docs/internal/PLANS.md`
- `docs/release/RELEASE_CHECKLIST.md`
- `docs/internal/QUESTIONS.md`
- `src/cli.ts`
- `tests/journey-ux.test.ts`
- `tests/help-ux.test.ts`
- `README.md`
- `docs/help/README.md`

## Risks
- UX copy changes can break snapshot-like expectations in tests.
- README hardening can drift from actual commands if not verified.
- Release checklist drift if not updated at each milestone.

## Validation Gates
- Milestone gate: `pnpm verify`
- Pre-release gate: `pnpm ship:gate`
- Optional hardening gate: `pnpm quality:evidence:verify`

## Progress
- [x] M0: Baseline repo audit and quality gate (`pnpm verify`) completed.
- [x] M1: Create steering artifacts and release checklist scaffolding.
- [x] M2: Harden onboarding/help UX for first-run + key failure guidance (tests first).
- [x] M3: Close docs gaps (README deploy/env vars + minimal docs/help landing page).
- [x] M4: Final checklist reconciliation, open questions capture, and release verification run.
- [x] M5: Multi-persona deep UX audit with transcript evidence and prioritized gap capture.
- [x] M6: Remediate all discovered P0/P1 UX gaps (journey freshness, error semantics, text-mode failures, onboarding command correctness).
- [x] M7: Publish product + backend scorecards with explicit evidence mapping.
- [x] M8: Replace simulated gameplay readiness with a real runtime API + web shell + script-level and UI-level test coverage.

## Surprises & Discoveries
- Repo already has broad automated coverage (240 tests) and strong CI workflows.
- `journey` command already provides progressive next-action guidance and docs links.
- Help and error guidance UX tests already exist and are passing.
- `journey` previously treated blocked scan/dry-run attempts as complete; this hid failure recovery paths. Added blocked-state handling and tests.
- Windows CI surfaced two nondeterministic checks (`resolver.benchmark` timing strictness and soak script runner portability) that required deterministic hardening.
- `journey` correctness depends on freshness, not just historical success events; stale-success states can silently erode operator trust.
- Frozen lockfile failures were technically correct (exit code) but text copy could still mislead humans into treating failures as successful apply output.
- Long-running full gates (`verify`, `doctor`, `ship:gate`) still complete cleanly after introducing runtime/web surfaces, but now run against 331 tests and require longer patience before final build outputs.
- GitHub Actions failures on latest heads moved from startup-only anomalies to explicit billing/quota job-start blocks; release governance now relies on RG-007 exception evidence until billing is restored.

## Decision Log
- 2026-02-14: Treat CLI output as product UX surface; prioritize copy clarity and recovery guidance over structural refactors.
- 2026-02-14: Keep milestone edits small to avoid broad regression risk before release.
- 2026-02-14: Stabilize script-level CI tests by adding explicit deterministic test hooks instead of relying on live `pnpm audit` behavior in test assertions.
- 2026-02-14: Execute soak runs via `node + tsx` directly rather than shelling through `pnpm` to avoid Windows command resolution variance.
- 2026-02-14: Treat freshness as first-class onboarding UX; step completion now requires up-to-date evidence relative to manifest/skills/lockfile changes.
- 2026-02-14: Prefer explicit failure headings in text mode (`Apply Failed`, `Bundle Verification Failed`) to avoid human misreads despite correct exit codes.
- 2026-02-17: Prioritize shipping a minimal but real runtime/web foundation over adding more CLI simulation modes; evidence must come from executable runtime flows.

## Outcomes & Retrospective
- Done:
  - Added repo steering artifacts (`AGENTS.md`, `docs/internal/PLANS.md`, `docs/release/RELEASE_CHECKLIST.md`, `docs/internal/QUESTIONS.md`).
  - Fixed onboarding journey state logic for blocked scan/apply failures with regression tests.
  - Added help landing page and linked it from CLI help + README.
  - Hardened README with setup/run/test/release/env-var sections.
  - Ran full verification repeatedly (`pnpm verify`) and final `pnpm ship:gate`.
  - Confirmed remote CI + CodeQL are green on commit `358fffc` (`CI` run `22019975631`, `CodeQL` run `22019975630`).
  - Added validated runtime contracts/store/server under `src/game/`, with onboarding, sync conflict, anti-tamper ranked, social/UGC/moderation, telemetry, crash, and readiness endpoints.
  - Added launchable runtime command `pnpm game:runtime` via `scripts/game_runtime.ts`.
  - Added accessible web shell in `apps/web/` with first-success flow, tooltips/help, and explicit error-state UX.
  - Added runtime coverage (`tests/game-runtime.test.ts`, `tests/game-runtime-shell.test.ts`, `tests/game-runtime-script.test.ts`) and updated CLI integration to tie `gameplay client` readiness to real assets.
  - Refreshed RG-007 exception evidence on latest head (`095f507`) with passing local compensating gates: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`, `pnpm release:verify-local`.
- Not done:
  - None for v1 definition-of-done gates.
- Lessons:
  - Journey guidance should treat failure states as first-class statuses, not just completion markers.

---

# ExecPlan: Five-star Post-v1 Pass

## Purpose / Big Picture
Move beyond v1 “release-ready” into a five-star quality bar by removing remaining friction points that reduce trust, usability, and automation reliability.

## Approach
- Use a repeated gap-driven loop with explicit quality categories (UX clarity, reliability, operability, performance/safety confidence).
- Execute only high-impact, low-risk increments with tests.
- Keep each increment under 5 files and commit after verification.

## Quality Categories (Five-star target)
- Onboarding Delight: zero-confusion first run and idempotent setup.
- Reliability at Edges: deterministic behavior across environments/timezones and repeated invocations.
- Operator Experience: fast diagnosis with actionable errors/help for scripts and humans.
- Trust Signals: journey/progress reflects current state, not stale history.

## Progress
- [x] FSP-0: Define five-star categories and prioritized TODO list.
- [x] FSP-1: Make `init` idempotent-success UX (repeat runs stay green with clear next step).
- [x] FSP-2: Add explicit `--help` UX for release scripts (`doctor`, `quality evidence verifier`).
- [x] FSP-3: Final evidence pass (`pnpm verify`, `pnpm doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`) and backlog reconciliation.

## Risks
- Exit-code changes may affect downstream scripts; mitigate with focused regression tests and explicit messaging.
- Script parser hardening may break undocumented usage; mitigate with friendly `--help`/errors.

## Validation Gates
- Targeted tests per increment.
- Full gate after each milestone: `pnpm verify`.
- Evidence gate: `pnpm run doctor` and `pnpm quality:evidence:verify`.
- Final release-hardening gate: `pnpm ship:gate`.

---

# ExecPlan: World-class Release Expansion (40 items)

## Purpose / Big Picture
Execute the full expansion backlog required to move from release-ready v1 to a five-star public-launch quality bar across reliability, UX, gameplay depth, trust/safety, and live operations.

## Approach
- Treat `docs/plans/2026-02-17-world-class-release-expansion-program.md` as the authoritative tracker.
- Keep increments under five files and commit each logical slice.
- Implement highest-impact unblocked tasks first.
- Require evidence (tests + gates) before marking tasks done.

## Milestones
- M0 Tracking + baseline gate refresh.
- M1 Core reliability/security foundations (WRX-001..012).
- M2 UX/a11y/localization/offline hardening (WRX-013..020).
- M3 Gameplay depth/retention improvements (WRX-021..030).
- M4 UGC/moderation/ops governance (WRX-031..040).
- M5 Final convergence gate.

## Validation Gates
- Per increment: targeted tests + `pnpm verify`.
- Per milestone: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.

## Progress
- [x] M0: Program tracker created and synced into `docs/internal/TODO.md`.
- [x] M1: Complete (WRX-001..012 complete).
- [x] M2: Complete (WRX-013..020 complete).
- [x] M3: Complete (WRX-021..030 complete).
- [x] M4: Complete (WRX-031..040 complete).
- [x] M5: Complete.
- [x] M6: Additional pre-release gate backlog (PRX-01..040) tracked in `docs/plans/2026-02-17-pre-release-gate-world-class-backlog.md` and mirrored in `docs/internal/TODO.md`.

---

# ExecPlan: Frontend 100/100 Excellence Program

## Purpose / Big Picture
Lift all 12 frontend UX/UI/journey criteria to a world-class 100/100 standard through an evidence-based multi-milestone program.

## Approach
- Use `docs/plans/2026-02-19-frontend-100-score-execution-plan.md` as the authoritative task backlog.
- Execute milestone-by-milestone with strict quality gates and evidence artifacts.
- Prioritize foundation (architecture, testing, IA) before polish-heavy workstreams.

## Progress
- [x] F100-0: Baseline criteria and target matrix established.
- [x] F100-1: Exhaustive task plan (WS-01..WS-13) documented.
- [x] F100-2: TODO mirror created for milestone/workstream tracking.
- [x] F100-3: M0 foundation execution started.
- [x] F100-4: M0 governance artifacts completed (`PRG-01`, `PRG-02`, `PRG-03`, `ARC-01`, `ARC-02`, `TST-01`).
- [x] F100-5: M0 code scaffolding in progress (`ARC-03`, `ARC-04`).
- [x] F100-6: M0 complete (PRG-01..03 and ARC-01..04 done with test/toolchain evidence).
- [x] F100-7: M1 execution started (ARC-05..10, TST-02..03).
- [x] F100-8: M1 complete (state store, UI primitives, architecture boundary rules, maintainability checklist, and unit tests).
- [x] F100-9: M2 complete (brand/tokens docs, navigation map, persistent nav shell, breadcrumbs, and M2 gate evidence).
- [x] F100-10: M3 complete (page hierarchy pattern, command bar, decision-tree empty states, success criteria, and core dashboard/profile/onboarding/challenge surfaces).
- [x] F100-11: M4 complete (onboarding funnels/state-machine, persistence, coachmarks, skip/resume/bootstrap, diagnostics, telemetry transitions, and campaign surface).
- [x] F100-12: M5-M9 completed (interaction/recovery polish, accessibility/mobile guards, surface completeness, perf/testing depth, wow/governance artifacts, and full regression evidence).
- [x] F100-13: Runtime browser security hardening complete (origin/CSRF + rate-limit + session-boundary controls with regression coverage and refreshed gate evidence).
- [x] F100-14: Web shell auth lifecycle polish complete (session propagation on mutating actions + explicit in-app logout control).

## Risks
- Architecture transition could create temporary delivery slowdown.
- Large UI surface expansion can introduce scope creep without strict milestone exits.

## Validation Gates
- Per milestone: targeted tests + `pnpm verify`.
- Evidence gates: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.

## Outcomes & Retrospective
- Done:
  - Closed remaining frontend 100/100 backlog tasks with runtime shell upgrades, typed contract alignment, and expanded journey/perf/a11y/visual test gates.
  - Added CI-enforced coverage, visual regression, accessibility/mobile regression, frontend perf budgets, and device-matrix artifact generation.
  - Published governance/wow artifacts for cadence, escalation, critique rounds, dry-run/demo operations, and feedback intake.
  - Added runtime browser security hardening (defensive headers, origin/CSRF checks, endpoint rate limits, profile-scoped session checks) and locked it with dedicated regression tests.
  - Added web-shell session continuity and explicit logout UX so profile-scoped mutation boundaries are enforced and user-manageable in-app.
- Not done:
  - None in the tracked 100/100 frontend program.
- Lessons:
  - Treat UI shell quality work as a blend of executable gates and explicit operational artifacts; both are required for reproducible release confidence.

---

# ExecPlan: Launch Exhaustive Sweep (2026-02-21)

## Purpose / Big Picture
Perform an exhaustive pre-launch validation and deployment-readiness sweep so tomorrow's launch decision is backed by fresh, end-to-end evidence.

## Approach
- Define explicit launch deployment steps and a run checklist.
- Execute every quality/performance/security/release integrity command with fresh artifacts.
- Run live runtime smoke checks beyond automated suites.
- Update release evidence docs with exact run IDs/timestamps and incident status.

## Progress
- [x] L0: Deployment plan created (`docs/release/launch-deployment-plan-2026-02-21.md`).
- [x] L1: Exhaustive automated matrix executed (verify/doctor/ship/evidence/perf/security/release).
- [x] L2: Live runtime smoke and journey checks completed.
- [x] L3: CI status + RG-007 incident evidence refreshed.
- [x] L4: Final release report and go/no-go decision published.
- [x] L5: Latest-head (`ec483bf`) evidence reconfirmed with fresh local gates + frontend UX checks and updated RG-007 incident records.
- [x] L6: Latest-head (`745ebbc`) evidence reconfirmed with fresh local gates and updated RG-007 incident records.
- [x] L7: Latest-head (`82c7d6a`) evidence reconfirmed with fresh local gates and updated RG-007 incident records.
- [x] L8: Latest-head (`8f7db16`) evidence reconfirmed, CI/CodeQL manually rerun, and RG-007 records refreshed.
- [x] L9: Latest-head (`1edd6de`) evidence reconfirmed, CI/CodeQL manually rerun, and RG-007 records refreshed.

## Validation Gates
- `pnpm verify`
- `pnpm run doctor`
- `pnpm ship:gate`
- `pnpm ship:gate -- --skip mutation --skip fuzz-differential`
- `pnpm quality:evidence:verify`
- `pnpm release:verify-local`

---

# ExecPlan: UX Simplification World-class Pass (2026-02-20)

## Purpose / Big Picture
Reduce front-end complexity and cognitive load so first-run users can confidently reach first success, while preserving fast paths for returning/power users.

## Approach
- Use `docs/plans/2026-02-20-ux-simplification-world-class-pass.md` as the authoritative implementation tracker.
- Execute phase-by-phase with small, low-risk increments (<=5 files per increment).
- Keep runtime API contracts unchanged; focus on UX orchestration, copy, and disclosure behavior.

## Progress
- [x] UXP-0: Baseline evidence captured (nav/action density + fresh doctor artifact).
- [x] UXP-1: Phase 1 complete (core-first navigation + advanced disclosure).
- [x] UXP-2: Phase 2 complete (guided first-success journey clarity).
- [x] UXP-3: Phase 3 complete (error/empty/help copy and recovery clarity).
- [x] UXP-4: Phase 4 complete (layout density and visual hierarchy polish).
- [x] UXP-5: Phase 5 complete (accessibility and keyboard refinement).
- [x] UXP-6: Phase 6 complete (full quality gates + evidence refresh).
- [x] UXP-7: Follow-up hardening complete (first-run welcome overlay wiring, explore hub orchestration, collapsible help-panel controls, updated docs/help guidance, and refreshed visual/runtime regression baselines on 2026-02-21).

## Validation Gates
- Phase gate: targeted frontend tests for touched behaviors.
- Milestone gate: `pnpm verify`.
- Evidence gate: `pnpm run doctor`.
