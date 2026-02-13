# Incident Playbook

## Incident classes
- `P0`: Active integrity compromise risk (signature mismatch, tampered artifact).
- `P1`: Release-blocking reliability failure (ship gate non-determinism, repeated CI gate failures).
- `P2`: Degraded operator experience with workaround available.

## First 30 minutes
1. Classify severity (`P0/P1/P2`).
2. Freeze release actions for `P0`/`P1`.
3. Capture evidence artifacts:
- failing workflow logs
- `ship-gate.summary.json`
- `ship-gate.evidence.verify.json`
- release verification artifacts when relevant
4. Open incident record with timeline and owner.

## Containment
1. Revoke suspect release artifacts from distribution channels.
2. Rotate signing keys when key misuse is suspected.
3. Disable risky path (for example, stop release workflow) until verification is restored.

## Recovery
1. Implement minimal fix for root cause.
2. Re-run `pnpm ship:gate` and release verification.
3. Reissue artifacts with fresh checksums, manifest, and release notes.

## Post-incident requirements
1. Publish postmortem with root cause and preventive actions.
2. Add regression tests/fixtures for the incident class.
3. Update runbooks/policies when gaps are identified.
