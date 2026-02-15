# World-Class Overnight Feature Suite (Execution Tracker)

## Goal
Ship six genuinely difficult, high-impact features in one methodical execution pass with complete tracking, tests, and release-gate evidence.

## Feature Set
1. Mission Control TUI experience
2. Autonomous Remediation Engine v2
3. Continuous Drift Daemon + Alerting
4. Policy Simulator + Explain Graph
5. Trust Center + Key Lifecycle UX
6. Session Replay + Journey Analytics

## Execution Rules
- One feature at a time.
- For each feature: RED test -> GREEN implementation -> verify -> commit.
- Keep each increment reviewable and low-risk.
- Update this tracker and `TODO.md` after every milestone.
- Run targeted tests after each change; run full gates at final convergence.

## Exhaustive Task Matrix

### NX1: Mission Control TUI Experience
- [x] Add `runwright mission` command with keyboard-first, sectioned dashboard output.
- [x] Surface onboarding status, trust health, scan/policy summary, and next-best-action.
- [x] Add action runner hooks (`scan`, `fix`, `apply --dry-run`, `journey`) from mission view.
- [x] Add machine-readable `--json` payload for mission state.
- [x] Add integration tests for mission happy-path and action execution.

### NX2: Autonomous Remediation Engine v2
- [x] Add remediation risk scoring and deterministic priority ordering.
- [x] Add `fix --autopilot` flow with risk threshold guardrails.
- [x] Add structured preview metadata for planned changes.
- [x] Block unsafe auto-apply and return explicit recovery guidance.
- [x] Add integration tests for autopilot apply and blocked high-risk cases.

### NX3: Continuous Drift Daemon + Alerting
- [x] Extend watch mode with persisted state (`lastCycle`, `status`, counters).
- [x] Add bounded daemon controls (`--max-cycles`) for unattended runs.
- [x] Add alert hook command execution on failing/blocked cycles.
- [x] Persist cycle history summaries for observability.
- [x] Add integration tests for state persistence and alert triggering.

### NX4: Policy Simulator + Explain Graph
- [x] Add `runwright policy simulate` subcommand.
- [x] Accept scenario input payloads and evaluate policy outcomes deterministically.
- [x] Emit explain graph in JSON and Mermaid-compatible text.
- [x] Return failure status when simulated decisions deny required actions.
- [x] Add integration tests for simulation decisions and graph output.

### NX5: Trust Center + Key Lifecycle UX
- [x] Add `runwright trust` command surface (`status`, `revoke`, `rotate-plan`).
- [x] Persist trust key metadata and revocation state in project-local store.
- [x] Validate bundle/registry key IDs against revocation state.
- [x] Add clear operator UX for rotation plans and revoked key impacts.
- [x] Add integration tests for revoke/rotation planning and enforcement.

### NX6: Session Replay + Journey Analytics
- [ ] Add `runwright analytics journey` command.
- [ ] Compute journey funnel metrics from operation logs (attempts, success rate, failures).
- [ ] Add replay summaries for last failed flow with concrete recovery commands.
- [ ] Add persona-oriented score payload (`new-user`, `operator`, `release-manager`).
- [ ] Add integration tests for analytics payload and replay guidance.

## Verification Gates
- Per feature: targeted `vitest` command(s) for touched flows.
- Final full gate:
  - `pnpm verify`
  - `pnpm run doctor`
  - `pnpm quality:evidence:verify`
  - `pnpm ship:gate`

## Status Ledger
- Started: 2026-02-15
- Current phase: NX6 Session Replay + Journey Analytics
- Completion target: all six features implemented + verified + tracked
