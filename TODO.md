# Five-star TODO (Post-v1)

## P0 (Highest impact)
- [x] Make `runwright init` idempotent-success:
  - second run exits `0`
  - copy explains existing setup and next step
  - operation event mutating flag remains accurate

- [x] Add script-level help for operator workflows:
  - `scripts/doctor.ts --help`
  - `scripts/verify_quality_evidence.ts --help`
  - include usage and examples, keep strict arg validation

## P1 (High impact)
- [x] Re-run full quality/evidence gates and confirm artifacts:
  - `pnpm verify`
  - `pnpm run doctor`
  - `pnpm quality:evidence:verify`
  - `pnpm ship:gate`

- [x] Reconcile docs/backlog with final state:
  - `GAPS.md`
  - `RELEASE_CHECKLIST.md`
  - `PLANS.md` progress

## P0 (Overnight next-level build)
- [ ] Execute full triple-feature plan from `docs/plans/2026-02-15-next-level-feature-suite.md`

- [ ] Workstream A: Trusted remote registry + signed artifact resolution
  - Add trust policy schema to manifest with source-level signature requirements
  - Upgrade lockfile format to capture transport + integrity + signature verification metadata
  - Add ed25519 verification path for remote sources before materialization/install
  - Add deterministic cache behavior for online/offline/ttl refresh paths
  - Add CLI trust UX for `update`, `scan`, and `apply` (clear trust pass/fail guidance)
  - Add tamper, key-rotation, and stale-cache regression coverage

- [ ] Workstream B: Policy-as-code engine with `--explain`
  - Add policy rule schema and evaluation model
  - Implement policy engine with deterministic rule ordering and structured outcomes
  - Add `runwright policy check --explain` in text and JSON modes
  - Emit machine-readable decision artifacts for CI evidence
  - Add rule-focused tests (allow/deny/warn, precedence, explainability, invalid policy)

- [ ] Workstream C: `runwright fix` auto-remediation planner + rollback
  - Add planner that converts findings/violations into explicit operation plans
  - Add preview output showing file diffs + command side effects before apply
  - Add transactional apply mode with backup snapshot and rollback on failure
  - Add safety rails for destructive operations and unsupported remediations
  - Add end-to-end tests for plan-only, apply success, partial failure rollback, idempotent reruns

- [ ] Final convergence gate
  - Run targeted tests per task, then full `pnpm verify`
  - Run evidence gates: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`
  - Update `GAPS.md`, `RELEASE_CHECKLIST.md`, `PLANS.md`, and release evidence artifacts
