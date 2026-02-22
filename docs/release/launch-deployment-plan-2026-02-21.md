# Launch Deployment Plan (2026-02-21)

## Objective
Ship Runwright with verifiable local release gates, explicit rollback readiness, and documented CI-incident exception evidence if GitHub Actions remains externally blocked.

## Preconditions
- Local branch is clean and pushed.
- `pnpm install` is already complete.
- Required release env vars are set for signing and verification paths as documented in `README.md`.
- Existing runbooks available:
  - `docs/release/rollout-and-rollback.md`
  - `docs/release/oncall-incident-playbook.md`
  - `docs/release/legal-compliance-pack.md`
  - `docs/release/app-store-readiness-pack.md`

## Phase 1: Exhaustive Validation
Run and record all launch-critical checks:

1. Full quality gate:
   - `pnpm verify`
2. Doctor evidence:
   - `pnpm run doctor`
3. Ship gate (full):
   - `pnpm ship:gate`
4. Ship gate (narrow exception profile):
   - `pnpm ship:gate -- --skip mutation --skip fuzz-differential`
5. Quality evidence:
   - `pnpm quality:evidence:verify`
   - `pnpm tsx scripts/verify_quality_evidence.ts --require-check verify --require-check audit --require-check sbom --require-check release-verify-local`
6. Release artifact verification:
   - `pnpm release:verify-local`
7. Focused frontend/runtime checks:
   - `pnpm test:web-a11y`
   - `pnpm test:visual`
   - `pnpm perf:frontend:check`
   - `pnpm perf:frontend:soak`
   - `pnpm qa:frontend:matrix`
8. Deep trust/perf checks:
   - `pnpm test:coverage`
   - `pnpm test:fuzz-differential`
   - `pnpm test:mutation`
   - `pnpm ship:soak`

## Phase 2: Live Runtime Smoke
Validate live behavior with the real runtime:

1. Start runtime shell:
   - `pnpm game:runtime`
2. Confirm health/help/readiness endpoints:
   - `GET /v1/health`
   - `GET /v1/help`
   - `GET /v1/release/readiness`
3. Web journey smoke:
   - profile creation
   - session creation and logout
   - tutorial/save/publish/ranked flow
   - error-state recovery visibility

## Phase 3: Deployment and Rollout
1. Create release artifact and verify signatures/attestations.
2. Publish GitHub release artifacts (v1 distribution channel).
3. Roll out using `docs/release/rollout-and-rollback.md` staged percentages.
4. Monitor with `docs/release/oncall-incident-playbook.md`.
5. Trigger rollback immediately if defined thresholds are crossed.

## Phase 4: CI and Exception Handling
1. Re-run GitHub `CI` and `CodeQL` on latest commit.
2. If workflows still fail with `steps: 0` startup failures, keep RG-007 exception active:
   - capture run IDs in `docs/internal/QUESTIONS.md`
   - record compensating local evidence in `docs/release/RELEASE_CHECKLIST.md`
3. Exit exception path once GitHub billing/quota is restored and both workflows run successfully.

## Exit Criteria (Launch Go)
- All local gates and exhaustive checks pass with fresh artifacts.
- Release checklist, gaps, and open questions are updated with current timestamps.
- Rollout/rollback/on-call docs are current and linked.
- CI is green OR RG-007 exception path is fully evidenced and approved.
