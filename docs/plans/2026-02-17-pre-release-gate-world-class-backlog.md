# Pre-release Gate World-class Backlog (Additional 40)

## Purpose
Track the full additional pre-release scope requested in this session, with explicit status and evidence for each item.

## Execution Rule
- Implement highest-impact unblocked gaps first.
- Every completed item must map to an executable command or artifact.
- Treat CI provider billing lockouts as external incidents; satisfy RG-007 exception evidence while blocked.

## Backlog
- [x] PRX-01 CI release-gate continuity on latest heads (green CI or RG-007 exception evidence).
  - Evidence: `RELEASE_CHECKLIST.md`, `QUESTIONS.md`, `GAPS.md`, `pnpm verify`, `pnpm ship:gate`
- [x] PRX-02 Release-candidate smoke flow across primary journeys.
  - Evidence: `runwright gameplay launch --json`, `tests/cli.integration.test.ts`
- [x] PRX-03 Runtime/client shell readiness.
  - Evidence: `runwright gameplay client --json`, `apps/web/index.html`, `scripts/game_runtime.ts`
- [x] PRX-04 Auth lifecycle hardening surface.
  - Evidence: `src/game/runtime.ts`, `tests/game-runtime.test.ts`
- [x] PRX-05 Account recovery boundary coverage.
  - Evidence: `src/game/runtime.ts`, `tests/game-runtime.test.ts`
- [x] PRX-06 Cloud save conflict policy.
  - Evidence: `runwright gameplay sync --json`, `tests/cli.integration.test.ts`
- [x] PRX-07 Cross-surface progression consistency.
  - Evidence: `src/game/contracts.ts`, `src/game/runtime-store.ts`
- [x] PRX-08 Telemetry ingestion durability/validation.
  - Evidence: `src/game/runtime.ts`, `runwright gameplay telemetry --json`
- [x] PRX-09 Crash diagnostics and redaction flow.
  - Evidence: `runwright gameplay crash --json`, `tests/game-runtime.test.ts`
- [x] PRX-10 Legal/privacy/compliance pack.
  - Evidence: `docs/release/legal-compliance-pack.md`
- [x] PRX-11 First-10-minute onboarding arc.
  - Evidence: `runwright gameplay tutorial --json`
- [x] PRX-12 Contextual tutorial pacing by persona.
  - Evidence: `runwright gameplay tutorial --json`
- [x] PRX-13 Failure recovery assistant flow.
  - Evidence: `runwright gameplay recovery --json`
- [x] PRX-14 Campaign chaptering and pacing.
  - Evidence: `runwright gameplay campaign --json`, `tests/cli.integration.test.ts`
- [x] PRX-15 Economy balancing simulator.
  - Evidence: `runwright gameplay campaign --json`, `tests/cli.integration.test.ts`
- [x] PRX-16 Boss encounter depth.
  - Evidence: `runwright gameplay boss --json`
- [x] PRX-17 Quest variety and repeatability controls.
  - Evidence: `runwright gameplay challenge --json`
- [x] PRX-18 Achievement/milestone progression.
  - Evidence: `runwright gameplay achievements --json`, `tests/cli.integration.test.ts`
- [x] PRX-19 Daily/weekly cadence controls.
  - Evidence: `runwright gameplay liveops --json`, `tests/cli.integration.test.ts`
- [x] PRX-20 Replay editor/export path.
  - Evidence: `runwright gameplay replay --json`, `tests/cli.integration.test.ts`
- [x] PRX-21 Spectator mode baseline.
  - Evidence: `runwright gameplay spectate --json`, `tests/cli.integration.test.ts`
- [x] PRX-22 Ghost ladder event retention layer.
  - Evidence: `runwright gameplay liveops --json`, `tests/cli.integration.test.ts`
- [x] PRX-23 Party/friends/invite flow.
  - Evidence: `runwright gameplay social --json`
- [x] PRX-24 Co-op host migration + reconnect.
  - Evidence: `runwright gameplay coop --scenario host-migrate --json`, `tests/cli.integration.test.ts`
- [x] PRX-25 Ranked integrity boundary.
  - Evidence: `runwright gameplay ranked --json`, `src/game/runtime.ts`
- [x] PRX-26 Anti-cheat enforcement visibility.
  - Evidence: `src/game/runtime.ts`, `tests/game-runtime.test.ts`
- [x] PRX-27 Creator authoring guidance and validation.
  - Evidence: `runwright gameplay creator --json`
- [x] PRX-28 UGC moderation + appeals lifecycle.
  - Evidence: `runwright gameplay creator --scenario appeal --json`
- [x] PRX-29 UGC discovery/ranking quality signals.
  - Evidence: `runwright gameplay creator --json`
- [x] PRX-30 Seasonal LiveOps operations controls.
  - Evidence: `runwright gameplay liveops --json`
- [x] PRX-31 Remote config + experimentation controls.
  - Evidence: `runwright gameplay experiment --json`, `tests/cli.integration.test.ts`
- [x] PRX-32 In-app searchable help center.
  - Evidence: `runwright gameplay helpdesk --json`, `tests/cli.integration.test.ts`
- [x] PRX-33 Accessibility support surface completeness.
  - Evidence: `runwright gameplay accessibility --json`
- [x] PRX-34 Controller profile support surface.
  - Evidence: `runwright gameplay accessibility --json`, `tests/cli.integration.test.ts`
- [x] PRX-35 Localization fallback/readiness.
  - Evidence: `runwright gameplay localization --json`
- [x] PRX-36 Offline-first replayable sync queue.
  - Evidence: `runwright gameplay sync --description offline --json`
- [x] PRX-37 Performance budget enforcement in CI/local gates.
  - Evidence: `tests/performance-budget.test.ts`, `pnpm verify`
- [x] PRX-38 QA matrix and signoff criteria.
  - Evidence: `runwright gameplay qa --json`, `tests/cli.integration.test.ts`
- [x] PRX-39 Closed beta + balance gate.
  - Evidence: `docs/release/closed-beta-and-lc-freeze.md`, `runwright gameplay launch --json`
- [x] PRX-40 Launch operations (rollout, rollback, on-call, store pack).
  - Evidence: `docs/release/rollout-and-rollback.md`, `docs/release/oncall-incident-playbook.md`, `docs/release/app-store-readiness-pack.md`

## Completion
- All 40 items have implementation or evidence coverage in this repo's current architecture.
- Remaining external constraint: GitHub-hosted CI billing lockout, mitigated through documented RG-007 exception evidence until provider access is restored.
