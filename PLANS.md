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
- `PLANS.md`
- `RELEASE_CHECKLIST.md`
- `QUESTIONS.md`
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
  - Added repo steering artifacts (`AGENTS.md`, `PLANS.md`, `RELEASE_CHECKLIST.md`, `QUESTIONS.md`).
  - Fixed onboarding journey state logic for blocked scan/apply failures with regression tests.
  - Added help landing page and linked it from CLI help + README.
  - Hardened README with setup/run/test/release/env-var sections.
  - Ran full verification repeatedly (`pnpm verify`) and final `pnpm ship:gate`.
  - Confirmed remote CI + CodeQL are green on commit `358fffc` (`CI` run `22019975631`, `CodeQL` run `22019975630`).
  - Added validated runtime contracts/store/server under `src/game/`, with onboarding, sync conflict, anti-tamper ranked, social/UGC/moderation, telemetry, crash, and readiness endpoints.
  - Added launchable runtime command `pnpm game:runtime` via `scripts/game_runtime.ts`.
  - Added accessible web shell in `apps/web/` with first-success flow, tooltips/help, and explicit error-state UX.
  - Added runtime coverage (`tests/game-runtime.test.ts`, `tests/game-runtime-shell.test.ts`, `tests/game-runtime-script.test.ts`) and updated CLI integration to tie `gameplay client` readiness to real assets.
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
- [x] M0: Program tracker created and synced into `TODO.md`.
- [ ] M1: In progress (WRX-006 complete; remaining WRX-001..005, WRX-007..012 pending).
- [ ] M2: In progress (WRX-017, WRX-018, WRX-019, and WRX-033 complete; remaining WRX-013..016 and WRX-020 pending).
- [ ] M3: Pending.
- [ ] M4: In progress (WRX-033 and WRX-034 complete; remaining WRX-031..032 and WRX-035..040 pending).
- [ ] M5: Pending.
