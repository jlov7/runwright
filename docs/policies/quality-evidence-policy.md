# Quality Evidence Policy

## Purpose
Define machine-verifiable quality evidence required for scrutiny-grade CI and release workflows.

## Evidence artifacts
1. Test and verification evidence
- `pnpm verify` output (lint, typecheck, tests, build)
- Mutation report artifact (`reports/mutation/mutation.json`, HTML)
- Differential fuzz summary artifact (`.fuzz-artifacts/manifest-differential/*/summary.json`)

2. Supply-chain evidence
- Dependency audit output (`pnpm audit:deps`)
- CycloneDX SBOM artifact (`reports/sbom/bom.json`)

3. Security evidence
- Scanner SARIF artifact
- CodeQL workflow results
- Signed release verification artifacts + GitHub attestations

4. Consolidated status evidence
- CI scorecard artifacts:
  - `reports/quality/ci-scorecard.json`
  - `reports/quality/ci-scorecard.md`
- CI quality evidence verdict:
  - `reports/quality/ci-evidence.verify.json`
- Release scorecard artifacts:
  - `release-scorecard.json`
  - `release-scorecard.md`
  - `release-scorecard.verify.json`
- Reliability soak artifacts:
  - `reports/quality/soak/ship-gate-soak.report.json`
- Performance trend artifacts:
  - `reports/performance/current.snapshot.json`
  - `reports/performance/trend.report.json`
- Release integrity artifacts:
  - `tag-signature.verify.json`
  - `release-artifact-manifest.json`
  - `release-artifact-manifest.verify.json`
  - `release-notes.md`

## Policy rules
- Scorecard checks must be `success` for protected-branch merges.
- `scripts/verify_quality_evidence.ts` is the authoritative gate evaluator for scorecard/evidence quality.
- `pnpm ship:gate` is the canonical local orchestration command for end-to-end release readiness checks.
- `pnpm ship:soak` enforces repeated ship-gate consistency checks and artifact diff validation.
- Mutation score target is enforced by Stryker thresholds in `stryker.config.mjs`.
- Fuzz mismatches are release blockers.
- Release artifacts are not publishable unless consumer verification succeeds.
- Release tag signatures must verify for tag-triggered releases.
- Immutable release artifact manifest verification must pass before publishing.
- Performance trend checks must remain within configured regression deltas.

## Schema contracts
- Scorecards must validate against `docs/schemas/quality/scorecard.schema.json`.
- Evidence verification payloads must validate against `docs/schemas/quality/evidence-verification.schema.json`.
- Ship-gate summary payloads must validate against `docs/schemas/quality/ship-gate-summary.schema.json`.
- Ship-gate stage-log payloads must validate against `docs/schemas/quality/ship-gate-stage-logs.schema.json`.
- Ship-gate soak reports must validate against `docs/schemas/quality/ship-gate-soak-report.schema.json`.
- Performance snapshots must validate against `docs/schemas/quality/performance-snapshot.schema.json`.
- Performance trend reports must validate against `docs/schemas/quality/performance-trend-report.schema.json`.
- Release tag signature reports must validate against `docs/schemas/quality/release-tag-signature-report.schema.json`.
- Release artifact manifests must validate against `docs/schemas/quality/release-artifact-manifest.schema.json`.
- Release artifact manifest verification payloads must validate against `docs/schemas/quality/release-artifact-manifest-verify.schema.json`.

## Retention guidance
- Keep scorecards, mutation reports, fuzz summaries, and SBOMs for each release candidate.
- Preserve release attestation bundles and public key history for audit replay.
