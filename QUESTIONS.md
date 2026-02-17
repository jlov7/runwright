# Open Questions

## Q1: v1 distribution channel
- Question: Is v1 release expected as npm package publication, GitHub release artifacts only, or both?
- Why it matters: README deploy/release notes and final release steps depend on the target channel.
- Decision (2026-02-15): Treat GitHub release artifacts as the required distribution channel for v1; npm publication is optional and out-of-band.
- Status: Resolved

## Q2: Required signing mode for v1 release
- Question: Should v1 require signature verification (`--require-signature`) in release policy, and if yes, which key mode (HMAC vs ed25519)?
- Why it matters: Determines required env vars and release runbook defaults.
- Decision (2026-02-15): Require ed25519 signatures for production release artifacts; keep HMAC documented for local/dev-only workflows.
- Status: Resolved

## Q3: CI status confirmation source of truth
- Question: Should release sign-off require explicit verification of current GitHub Actions run status, or is local `pnpm verify` + `pnpm ship:gate` sufficient for v1 sign-off?
- Why it matters: `RELEASE_CHECKLIST.md` includes a CI-green requirement that is not directly verifiable offline.
- Current assumption: Remote GitHub checks are required for final sign-off and local gates are preconditions.
- Status: Resolved (2026-02-14) via successful latest-head runs (`CI` `22020438502`, `CodeQL` `22020438501`) on commit `669df6d`.

## Q4: Handling external CI platform startup failures
- Question: When GitHub Actions fails before any step executes (`steps: []` across jobs), should release sign-off allow the last known-good CI head plus fresh local doctor evidence?
- Why it matters: Latest commit `9a9d5c1` is blocked by platform-level startup failures (`CI` run `22020736688`, `CodeQL` run `22020736679`) with no code-level failure signal.
- Decision (2026-02-15): Approve a strict CI-incident fallback policy only for verifiable platform failures.
- Policy:
  - Default remains unchanged: latest-head `CI` and `CodeQL` must be green.
  - Exception allowed only when both workflows fail before any test/build step executes (startup/platform failure), and at least two reruns still fail the same way.
  - HEAD must pass full local release gates: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`, `pnpm release:verify-local`.
  - Incident evidence must be logged in `QUESTIONS.md` and `RELEASE_CHECKLIST.md` with run IDs and failure mode.
- Follow-up required: rerun CI after platform recovery; if code-related failures appear, cut a patch release or roll back.
- Status: Resolved

### Q4 update (2026-02-17)
- Latest pushed commit: `e2f2af2d85f49180cdedf3fc693938c1ddd0555a`.
- New GitHub workflow failures remain platform-startup style:
  - `CI` run `22104490175` (rerun failed jobs include `63883415895`, `63883415899`, `63883415905`; all `steps: []`).
  - `CodeQL` run `22104490239` (rerun failed job `63883417179`; `steps: []`).
- Prior rerun on same head also failed with zero-step jobs:
  - `CI` run `22104490175` earlier failed jobs `63883137400`, `63883137464`, `63883137475` (`steps: []`).
  - `CodeQL` run `22104490239` earlier failed job `63883137597` (`steps: []`).
- Compensating local evidence on this commit:
  - `pnpm verify` (331/331 tests passing, build success)
  - `pnpm run doctor` (`reports/doctor/doctor.json`, generated `2026-02-17T15:19:40.587Z`, `overall.ok: true`)
  - `pnpm quality:evidence:verify` (`reports/quality/evidence-verification.json`)
  - `pnpm ship:gate` (`reports/quality/ship-gate.summary.json`, generated `2026-02-17T15:22:53.137Z`, `overall.ok: true`)
- Status: Exception path active pending platform recovery rerun.

## Q5: npm registry/DNS access for dependency installs
- Question: What is the approved npm registry/mirror for this environment, or how should DNS be configured so `registry.npmjs.org` is reachable?
- Why it matters: `pnpm install` currently fails with `ENOTFOUND registry.npmjs.org`, preventing `pnpm run doctor` and all local release gate evidence.
- Resolution (2026-02-15): Environment connectivity recovered; `pnpm install`, `pnpm verify`, `pnpm run doctor`, and `pnpm release:verify-local` all executed successfully.
- Status: Resolved
