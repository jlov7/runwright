# Failure Mode Catalog

## Integrity failures
1. `bundle-verification-failed`
- Symptom: `verify-bundle` exits nonzero with integrity/signature error.
- Detection: CLI JSON error payload + release verify workflow.
- Mitigation: regenerate artifact, verify signature key chain, reissue manifest/checksums.

2. `invalid-lockfile`
- Symptom: frozen lockfile commands exit `11`.
- Detection: `apply/update --frozen-lockfile --json`.
- Mitigation: regenerate lockfile from trusted sources, review source drift before commit.

3. `duplicate-skill-name`
- Symptom: apply/update/export fail due to source collision.
- Detection: command JSON code.
- Mitigation: rename or filter conflicting skill picks.

## Reliability failures
1. Ship-gate stage instability
- Symptom: `ship:soak` report `consistent: false`.
- Detection: `ship-gate-soak.report.json` diffs.
- Mitigation: isolate non-deterministic stage output and normalize root cause.

2. Performance regression
- Symptom: `perf:trend:check` exits nonzero.
- Detection: `trend.report.json` comparison deltas.
- Mitigation: identify slow path, benchmark fix, adjust baseline only with justification.

## Governance failures
1. Unsigned or lightweight release tag
- Symptom: `release:tag:verify` exits nonzero on tag refs.
- Detection: `tag-signature.verify.json`.
- Mitigation: create signed annotated tag and rerun release workflow.

2. Artifact manifest mismatch
- Symptom: `release:artifact-manifest:verify` reports mismatches.
- Detection: `release-artifact-manifest.verify.json`.
- Mitigation: rebuild artifacts, regenerate manifest, verify immutability before publish.
