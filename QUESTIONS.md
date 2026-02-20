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
- Recent release-branch pushes continue to fail before any CI job execution due to external billing/quota gating on GitHub Actions:
  - `CI`/`CodeQL` runs `22109118266`/`22109118280`
  - `CI`/`CodeQL` runs `22110929744`/`22110929736`
  - `CI`/`CodeQL` runs `22111146887`/`22111146880`
  - `CI`/`CodeQL` runs `22112492942`/`22112492922`
  - `CI`/`CodeQL` runs `22112524863`/`22112524890`
  - Shared annotation: `job was not started because recent account payments have failed or spending limit needs to be increased`, with no actionable build/test logs.
- Compensating local evidence on current workspace head:
  - `pnpm verify` (343/343 tests passing, build success)
  - `pnpm run doctor` (`reports/doctor/doctor.json`, generated `2026-02-17T18:39:35.630Z`)
  - `pnpm quality:evidence:verify` (`reports/quality/evidence-verification.json`, `ok: true`)
  - `pnpm ship:gate` (`reports/quality/ship-gate.summary.json`, generated `2026-02-17T18:42:25.973Z`, `overall.ok: true`)
  - `pnpm release:verify-local` (passed on `2026-02-17`, release artifact verification: `ok`)
- Status: Exception path active pending billing restoration and CI rerun on latest head.

### Q4 update (2026-02-19)
- Latest `main` head `84e83fd` still fails pre-execution on both required workflows with zero-step jobs:
  - `CI` run `22203952764` (`verify` matrix + `quality-scorecard` all failed with `stepsCount: 0`; remaining jobs skipped with `stepsCount: 0`)
  - `CodeQL` run `22203952755` (`Analyze` failed with `stepsCount: 0`)
- `gh run view` confirms no workflow steps executed before failure for both runs, consistent with the existing RG-007 platform-incident exception profile.
- Status: Exception path remains active pending GitHub Actions billing/quota recovery and successful reruns on latest head.

### Q4 update (2026-02-20)
- Latest `main` head `a57fff9` still fails pre-execution on both required workflows with zero-step jobs:
  - `CI` run `22240155561` (all failing jobs reported `stepsCount: 0`; downstream jobs skipped with `stepsCount: 0`)
  - `CodeQL` run `22240155541` (`Analyze` failed with `stepsCount: 0`)
- `gh run view` confirms the failure mode remains startup-level (no workflow steps executed), matching the existing RG-007 incident exception profile.
- Status: Exception path remains active pending GitHub Actions billing/quota recovery and successful reruns on latest head.

### Q4 update (2026-02-20, post-launch-sweep commit)
- Latest `main` head `8b54389` still fails pre-execution on both required workflows with zero-step jobs:
  - `CI` run `22240196616` (all failing jobs reported `stepsCount: 0`; downstream jobs skipped with `stepsCount: 0`)
  - `CodeQL` run `22240196630` (`Analyze` failed with `stepsCount: 0`)
- `gh run view` confirms the failure mode remains startup-level (no workflow steps executed), matching the existing RG-007 incident exception profile.
- Status: Exception path remains active pending GitHub Actions billing/quota recovery and successful reruns on latest head.

### Q4 update (2026-02-20, UX simplification completion head)
- Latest `main` head `0d29cc9` still fails pre-execution on both required workflows with zero-step jobs:
  - `CI` run `22243078342` (`verify` matrix + `quality-scorecard` failed with `steps: []`; downstream jobs skipped with `steps: []`)
  - `CodeQL` run `22243078364` (`Analyze (javascript-typescript)` failed with `steps: []`)
- `gh run view` confirms no workflow steps executed before failure on both runs, consistent with the existing GitHub Actions billing/quota startup-failure profile.
- Fresh compensating evidence on `0d29cc9`:
  - `pnpm verify` (390/390 tests passing, build success)
  - `pnpm run doctor` (`reports/doctor/doctor.json`, generated `2026-02-20T22:10:42.841Z`, `overall.ok: true`)
  - `pnpm ship:gate` (`reports/quality/ship-gate.summary.json`, generated `2026-02-20T22:13:37.379Z`, `overall.ok: true`)
  - `pnpm quality:evidence:verify` (`reports/quality/evidence-verification.json`, `ok: true`)
  - `pnpm release:verify-local` (`release artifact verification: ok`)
- Status: Exception path remains active pending GitHub Actions billing/quota recovery and successful reruns on latest head.

## Q5: npm registry/DNS access for dependency installs
- Question: What is the approved npm registry/mirror for this environment, or how should DNS be configured so `registry.npmjs.org` is reachable?
- Why it matters: `pnpm install` currently fails with `ENOTFOUND registry.npmjs.org`, preventing `pnpm run doctor` and all local release gate evidence.
- Resolution (2026-02-15): Environment connectivity recovered; `pnpm install`, `pnpm verify`, `pnpm run doctor`, and `pnpm release:verify-local` all executed successfully.
- Status: Resolved
