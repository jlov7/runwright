# User Journeys

## 1) Solo Technical User
### Goal
Install and use trusted skills quickly.

### Journey
1. Run `init`.
2. Add local skills.
3. Run `update` and `scan`.
4. Dry-run `apply`.
5. Real `apply` and start working.

### Aha moment
Re-running apply does not cause drift.

### Critical UX requirement
User always knows the next command by running `skillbase journey`.

## 2) Team Lead / Platform Engineer
### Goal
Standardize skill delivery across the team.

### Journey
1. Define team-approved skills in manifest.
2. Enforce policy and lockfile checks in CI.
3. Require `ship:gate` before release.
4. Publish signed artifacts.

### Aha moment
Same manifest produces same install state on every machine.

### Critical UX requirement
Onboarding and release flows are scriptable and audit-friendly.

## 3) Security/Compliance Reviewer
### Goal
Confirm release integrity and risk posture.

### Journey
1. Review scan policies and allowlists.
2. Review CI scorecards and evidence verification.
3. Verify signatures/checksums/attestations.
4. Check immutable artifact manifest verification.

### Aha moment
Evidence is machine-readable and reproducible, not just narrative.

### Critical UX requirement
Policy/risk evidence can be reviewed without reading source code internals.

## 4) Non-Technical Stakeholder
### Goal
Understand readiness without reading source code.

### Journey
1. Review onboarding and runbooks.
2. Review pass/fail quality and release artifacts.
3. Confirm incident and break-glass procedures exist.

### Aha moment
Operational maturity is explicit and test-backed.

### Critical UX requirement
Status is legible in plain language with clear pass/fail signals.

## Definition of done across journeys
- Onboarding is quick and predictable.
- Risks are visible and policy-controlled.
- Releases are verifiable and auditable.
