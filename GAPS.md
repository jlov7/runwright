# Gap Backlog (Release-ready v1)

## P0

### P0-001: Missing executable doctor gate
- Evidence: No `pnpm doctor` command or consolidated `reports/doctor/doctor.json` artifact exists.
- Impacted journey: Release manager sign-off and repeatable release verification.
- Fix strategy: Add `scripts/doctor.ts`, add `doctor` package script, emit machine-readable gate results.
- Status: Open

### P0-002: Release gate definitions not formalized
- Evidence: No dedicated release gate document with explicit evidence requirements.
- Impacted journey: Go/no-go release decision and audit trail.
- Fix strategy: Create `RELEASE_GATES.md` with explicit gates, commands, and artifact expectations.
- Status: Done

## P1

### P1-001: Gap loop algorithm not enforced in working agreement
- Evidence: Prior `AGENTS.md` loop stopped at milestone planning semantics and did not define strict stop conditions.
- Impacted journey: Autonomous product hardening pass from planning to completion.
- Fix strategy: Add strict Gap Loop algorithm and stop conditions to `AGENTS.md`.
- Status: Done

### P1-002: Prioritized gap register missing
- Evidence: No dedicated backlog file with priority, evidence, journey impact, and strategy.
- Impacted journey: Methodical iteration across remaining release risk.
- Fix strategy: Maintain this `GAPS.md` and update statuses after each loop iteration.
- Status: Done

## P2

### P2-001: Product decision defaults still open
- Evidence: `QUESTIONS.md` still contains open release-channel and signing-mode decisions.
- Impacted journey: Final release policy hardening and operator clarity.
- Fix strategy: Keep assumptions documented; proceed on all unblocked technical gaps; mark blocked only if a gate depends on a decision.
- Status: Open
