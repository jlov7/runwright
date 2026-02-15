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
