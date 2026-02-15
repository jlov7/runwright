# Five-star TODO (Post-v1)

## Overnight hard features (execution order)
- [x] F1 Team Registry + Signed Sync
- [x] F2 Crash-Resumable Apply Engine
- [x] F3 Policy-as-Code Rule Packs
- [x] F4 Interactive Remediation Flow
- [x] F5 Continuous Drift Watch Mode
- [x] F6 Release Provenance + Attestation Pipeline

Tracker: `docs/plans/overnight-super-hard-features.md`

## P0 (World-class overnight feature suite)
- [x] Execute full six-feature program from `docs/plans/2026-02-15-world-class-next-level-feature-suite.md`
- [x] NX1 Mission Control TUI experience
- [x] NX2 Autonomous Remediation Engine v2
- [x] NX3 Continuous Drift Daemon + Alerting
- [x] NX4 Policy Simulator + Explain Graph
- [x] NX5 Trust Center + Key Lifecycle UX
- [x] NX6 Session Replay + Journey Analytics
- [x] Final convergence gate (`pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`)

## P0 (Overnight next-level build)
- [x] Execute full triple-feature plan from `docs/plans/2026-02-15-next-level-feature-suite.md`

- [x] Workstream A: Trusted remote registry + signed artifact resolution
  - Add trust policy schema to manifest with source-level signature requirements
  - Upgrade lockfile format to capture transport + integrity + signature verification metadata
  - Add ed25519 verification path for remote sources before materialization/install
  - Add deterministic cache behavior for online/offline/ttl refresh paths
  - Add CLI trust UX for `update`, `scan`, and `apply` (clear trust pass/fail guidance)
  - Add tamper, key-rotation, and stale-cache regression coverage

- [x] Workstream B: Policy-as-code engine with `--explain`
  - Add policy rule schema and evaluation model
  - Implement policy engine with deterministic rule ordering and structured outcomes
  - Add `runwright policy check --explain` in text and JSON modes
  - Emit machine-readable decision artifacts for CI evidence
  - Add rule-focused tests (allow/deny/warn, precedence, explainability, invalid policy)

- [x] Workstream C: `runwright fix` auto-remediation planner + rollback
  - Add planner that converts findings/violations into explicit operation plans
  - Add preview output showing file diffs + command side effects before apply
  - Add transactional apply mode with backup snapshot and rollback on failure
  - Add safety rails for destructive operations and unsupported remediations
  - Add end-to-end tests for plan-only, apply success, partial failure rollback, idempotent reruns

- [x] Final convergence gate
  - Run targeted tests per task, then full `pnpm verify`
  - Run evidence gates: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`
  - Update `GAPS.md`, `RELEASE_CHECKLIST.md`, `PLANS.md`, and release evidence artifacts

Latest evidence refresh (2026-02-15):
- Targeted workstream validation: `pnpm vitest run tests/manifest.test.ts tests/lockfile.test.ts tests/trust-signature.test.ts tests/resolver.test.ts tests/source-provider.contract.test.ts tests/policy-engine.test.ts tests/policy-rule-pack.test.ts tests/workflow-policy.test.ts tests/cli.integration.test.ts` (199/199 passing).
- Full convergence gate: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.
- Artifacts: `reports/doctor/doctor.json` (`generatedAt: 2026-02-15T23:39:16.231Z`), `reports/quality/ship-gate.summary.json` (`generatedAt: 2026-02-15T23:41:40.667Z`, `overall.ok: true`).
