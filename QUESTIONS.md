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
- Latest verification attempt (2026-02-15): Workflow history still shows latest reruns failing with zero executed steps; affected job IDs include `63641142163`, `63641142175`, `63641142179`, and `63641142329`.
- Current assumption: Treat this as an external platform blocker; continue local gap loop and anchor release evidence to the last known-good CI head until service recovers.
- Status: Open

## Q5: npm registry/DNS access for dependency installs
- Question: What is the approved npm registry/mirror for this environment, or how should DNS be configured so `registry.npmjs.org` is reachable?
- Why it matters: `pnpm install` currently fails with `ENOTFOUND registry.npmjs.org`, preventing `pnpm run doctor` and all local release gate evidence.
- Latest verification attempt (2026-02-15): `pnpm run doctor` failed due to missing `tsx`; `pnpm install` failed with `ENOTFOUND registry.npmjs.org`.
- Status: Open
