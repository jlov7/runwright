# Gap Backlog (Release-ready v1)

## P0

### P0-001: Missing executable doctor gate
- Evidence: `pnpm run doctor` now writes `reports/doctor/doctor.json` with all checks passing (`overall.ok: true`, generated `2026-02-14T16:04:02.937Z`).
- Impacted journey: Release manager sign-off and repeatable release verification.
- Fix strategy: Add `scripts/doctor.ts`, add `doctor` package script, emit machine-readable gate results.
- Status: Done

### P0-003: Latest-head CI evidence missing
- Evidence: Latest head `669df6d` is green in GitHub Actions (`CI` run `22020438502`, `CodeQL` run `22020438501`) and local doctor evidence is fresh (`reports/doctor/doctor.json`, generated `2026-02-14T16:25:29.080Z`, `overall.ok: true`).
- Impacted journey: Final release sign-off on current release branch head.
- Fix strategy: Push branch head, wait for `CI` and `CodeQL` to succeed, then record run IDs in docs.
- Status: Done

### P0-004: External GitHub Actions startup instability on latest head
- Evidence: Latest head `9a9d5c1` fails immediately in both workflows with zero executed steps (`CI` run `22020736688`, `CodeQL` run `22020736679`, all failed jobs show `steps: []`).
- Impacted journey: Final CI gate sign-off on most recent commit.
- Fix strategy: Retry once service stabilizes; keep release evidence anchored to last known-good CI head (`669df6d`) plus fresh local doctor artifacts.
- Status: Blocked (external platform)

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
