# External Scrutiny Program

## Objective
Run repeatable, evidence-driven external validation before GA release.

## Workstreams
1. Independent security review
- Scope: scanner policy, bundle verification, release signing, attestation chain.
- Output: findings report with severity and proof.

2. UX/operator review
- Scope: CLI ergonomics, error code clarity, documentation clarity, runbook usability.
- Output: structured feedback with reproduction steps.

3. Pilot user reliability trial
- Scope: reproducibility and compatibility across real repositories.
- Output: defect list, success/failure rates, friction points.

## Entry criteria
- `pnpm ship:gate` green.
- release verification workflow green.
- no unresolved `P0/P1` incidents.

## Exit criteria
- all critical/high findings remediated or explicitly risk-accepted with expiration.
- pilot success criteria met:
- >= 95% successful first-run setup
- >= 99% deterministic re-run behavior on pilot fixtures
- operator docs validated by at least one non-author reviewer

## Artifacts to retain
- scorecards and evidence verification outputs
- soak reports and performance trend reports
- signed release verification artifacts
- external review findings and remediation mapping
