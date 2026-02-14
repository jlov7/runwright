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

## Surprises & Discoveries
- Repo already has broad automated coverage (240 tests) and strong CI workflows.
- `journey` command already provides progressive next-action guidance and docs links.
- Help and error guidance UX tests already exist and are passing.
- `journey` previously treated blocked scan/dry-run attempts as complete; this hid failure recovery paths. Added blocked-state handling and tests.

## Decision Log
- 2026-02-14: Treat CLI output as product UX surface; prioritize copy clarity and recovery guidance over structural refactors.
- 2026-02-14: Keep milestone edits small to avoid broad regression risk before release.

## Outcomes & Retrospective
- Done:
  - Added repo steering artifacts (`AGENTS.md`, `PLANS.md`, `RELEASE_CHECKLIST.md`, `QUESTIONS.md`).
  - Fixed onboarding journey state logic for blocked scan/apply failures with regression tests.
  - Added help landing page and linked it from CLI help + README.
  - Hardened README with setup/run/test/release/env-var sections.
  - Ran full verification repeatedly (`pnpm verify`) and final `pnpm ship:gate`.
- Not done:
  - Live CI status confirmation from remote GitHub checks in this session.
- Lessons:
  - Journey guidance should treat failure states as first-class statuses, not just completion markers.
