# Five-star TODO (Post-v1)

## P0 (Active world-class release expansion backlog)
- [ ] Execute full 40-item program from `docs/plans/2026-02-17-world-class-release-expansion-program.md`
- [ ] WRX-001 CI hardening and deterministic workflow execution
- [ ] WRX-002 Production-grade runtime persistence and migration path
- [ ] WRX-003 Full account/auth lifecycle
- [ ] WRX-004 Cross-device identity linking/merge flow
- [ ] WRX-005 Authoritative progression/ranked write validation
- [x] WRX-006 Matchmaking orchestration (MMR + latency/region + reconnect)
- [ ] WRX-007 Durable cloud save with conflict audit trail
- [ ] WRX-008 Anti-cheat anomaly detection and enforcement hooks
- [ ] WRX-009 Telemetry ingestion validation and durability
- [ ] WRX-010 Crash reporting pipeline with diagnostics redaction
- [ ] WRX-011 CI-enforced performance budgets
- [ ] WRX-012 Security hardening and release provenance closure
- [ ] WRX-013 Adaptive first-10-minute onboarding optimization
- [ ] WRX-014 Contextual tutorial hint pacing
- [ ] WRX-015 Failure/recovery UX matrix completion
- [ ] WRX-016 Empty-state/copy polish across personas
- [x] WRX-017 Complete accessibility support surface
- [x] WRX-018 Localization framework maturity and fallback correctness
- [x] WRX-019 Offline/degraded-network deterministic queue/replay
- [ ] WRX-020 Premium game-feel feedback timing pass
- [ ] WRX-021 Progression economy balancing framework
- [ ] WRX-022 Boss encounter system deepening
- [ ] WRX-023 Replay/ghost share portability with integrity checks
- [ ] WRX-024 Challenge authoring templates + validation
- [ ] WRX-025 Procedural generation quality constraints
- [ ] WRX-026 Adaptive difficulty fairness guardrails
- [ ] WRX-027 Social graph maturity (friends/party/block/mute/privacy)
- [ ] WRX-028 Co-op join/leave/reconnect orchestration hardening
- [ ] WRX-029 Ranked integrity hardening + anti-inflation controls
- [ ] WRX-030 LiveOps controls expansion
- [ ] WRX-031 Creator moderation lifecycle and appeals
- [ ] WRX-032 UGC discovery/ranking quality signals
- [x] WRX-033 Abuse reporting workflow hardening
- [x] WRX-034 Gameplay analytics dashboard maturity
- [ ] WRX-035 QA matrix automation expansion
- [ ] WRX-036 Staged rollout + rollback operations maturity
- [ ] WRX-037 On-call/incident playbook completion
- [ ] WRX-038 App-store readiness pack
- [ ] WRX-039 Legal/compliance readiness pass
- [ ] WRX-040 Closed beta operations + launch-candidate freeze

Tracker: `docs/plans/2026-02-17-world-class-release-expansion-program.md`

## Overnight hard features (execution order)
- [x] F1 Team Registry + Signed Sync
- [x] F2 Crash-Resumable Apply Engine
- [x] F3 Policy-as-Code Rule Packs
- [x] F4 Interactive Remediation Flow
- [x] F5 Continuous Drift Watch Mode
- [x] F6 Release Provenance + Attestation Pipeline

Tracker: `docs/plans/overnight-super-hard-features.md`

## P0 (World-class overnight feature suite)
- [x] Execute full six-feature program from `docs/plans/2026-02-15-world-class-next-level-feature-suite.md`
- [x] NX1 Mission Control TUI experience
- [x] NX2 Autonomous Remediation Engine v2
- [x] NX3 Continuous Drift Daemon + Alerting
- [x] NX4 Policy Simulator + Explain Graph
- [x] NX5 Trust Center + Key Lifecycle UX
- [x] NX6 Session Replay + Journey Analytics
- [x] Final convergence gate (`pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`)

## P0 (Overnight next-level build)
- [x] Execute full triple-feature plan from `docs/plans/2026-02-15-next-level-feature-suite.md`

- [x] Workstream A: Trusted remote registry + signed artifact resolution
  - Add trust policy schema to manifest with source-level signature requirements
  - Upgrade lockfile format to capture transport + integrity + signature verification metadata
  - Add ed25519 verification path for remote sources before materialization/install
  - Add deterministic cache behavior for online/offline/ttl refresh paths
  - Add CLI trust UX for `update`, `scan`, and `apply` (clear trust pass/fail guidance)
  - Add tamper, key-rotation, and stale-cache regression coverage

- [x] Workstream B: Policy-as-code engine with `--explain`
  - Add policy rule schema and evaluation model
  - Implement policy engine with deterministic rule ordering and structured outcomes
  - Add `runwright policy check --explain` in text and JSON modes
  - Emit machine-readable decision artifacts for CI evidence
  - Add rule-focused tests (allow/deny/warn, precedence, explainability, invalid policy)

- [x] Workstream C: `runwright fix` auto-remediation planner + rollback
  - Add planner that converts findings/violations into explicit operation plans
  - Add preview output showing file diffs + command side effects before apply
  - Add transactional apply mode with backup snapshot and rollback on failure
  - Add safety rails for destructive operations and unsupported remediations
  - Add end-to-end tests for plan-only, apply success, partial failure rollback, idempotent reruns

- [x] Final convergence gate
  - Run targeted tests per task, then full `pnpm verify`
  - Run evidence gates: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`
  - Update `GAPS.md`, `RELEASE_CHECKLIST.md`, `PLANS.md`, and release evidence artifacts

Latest evidence refresh (2026-02-15):
- Targeted workstream validation: `pnpm vitest run tests/manifest.test.ts tests/lockfile.test.ts tests/trust-signature.test.ts tests/resolver.test.ts tests/source-provider.contract.test.ts tests/policy-engine.test.ts tests/policy-rule-pack.test.ts tests/workflow-policy.test.ts tests/cli.integration.test.ts` (199/199 passing).
- Full convergence gate: `pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.
- Artifacts: `reports/doctor/doctor.json` (`generatedAt: 2026-02-15T23:39:16.231Z`), `reports/quality/ship-gate.summary.json` (`generatedAt: 2026-02-15T23:41:40.667Z`, `overall.ok: true`).

## P0 (Overnight gameplay/world-class feature suite)
- [x] Execute full 12-feature gameplay plan from `docs/plans/2026-02-16-world-class-gameplay-feature-suite.md`
- [x] GX1 Adaptive Quest Onboarding Engine
- [x] GX2 Campaign Mode progression loop
- [x] GX3 Scenario Simulator + Boss Encounters
- [x] GX4 Deterministic Replay + Ghost Runs
- [x] GX5 AI Game Director (difficulty adaptation)
- [x] GX6 Co-op Multiplayer War Room
- [x] GX7 Procedural Challenge Generator
- [x] GX8 Skill Tree + build archetypes
- [x] GX9 LiveOps event system
- [x] GX10 Creator Studio (UGC level publishing)
- [x] GX11 Cinematic feedback/highlight timeline
- [x] GX12 Ranked mode + local leaderboard
- [x] Final convergence gate for gameplay suite

Gameplay suite evidence refresh (2026-02-16):
- Targeted mode validation: `pnpm exec vitest run tests/cli.integration.test.ts -t "gameplay"` (`12/12` gameplay tests passing).
- Full verification gate: `pnpm verify` (`316/316` tests passing).
- Full release gate: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.
- Artifacts: `reports/doctor/doctor.json` (`generatedAt: 2026-02-16T02:32:27.382Z`), `reports/quality/ship-gate.summary.json` (`generatedAt: 2026-02-16T02:34:53.220Z`, `overall.ok: true`).

## P0 (World-class game pre-release program)
- [x] Execute full 35-item pre-release program from `docs/plans/2026-02-16-world-class-game-pre-release-program.md`
- [x] RX1 Game client shell readiness
- [x] RX2 Unified game-state contract
- [x] RX3 Account/auth/profile progression
- [x] RX4 Save/load + cloud sync conflict policy
- [x] RX5 First-10-minute onboarding arc
- [x] RX6 Adaptive tutorial overlays + hints
- [x] RX7 Failure/recovery UX matrix
- [x] RX8 Progression economy balancing framework
- [x] RX9 Multi-phase boss encounter system
- [x] RX10 Replay + ghost challenge sharing
- [x] RX11 Challenge authoring templates
- [x] RX12 Procedural generation quality constraints
- [x] RX13 Adaptive difficulty guardrails
- [x] RX14 Co-op session orchestration (join/leave/reconnect)
- [x] RX15 Friends/party/invite flow
- [x] RX16 Ranked authoritative scoring model
- [x] RX17 Anti-cheat/anti-tamper safeguards
- [x] RX18 Seasonal LiveOps control system
- [x] RX19 UGC moderation and publish review flow
- [x] RX20 UGC discovery/rating surfacing
- [x] RX21 Telemetry event schema coverage
- [x] RX22 Analytics dashboard feed contract
- [x] RX23 Crash diagnostics and incident envelopes
- [x] RX24 Performance budget enforcement surfaces
- [x] RX25 Game-feel/cinematic timing controls
- [x] RX26 Accessibility feature pack
- [x] RX27 Localization readiness pack
- [x] RX28 Offline/degraded network policy
- [x] RX29 Abuse reporting workflow
- [x] RX30 QA device/locale/latency matrix
- [x] RX31 Staged rollout + rollback runbook
- [x] RX32 On-call operations playbook
- [x] RX33 App-store release pack checklist
- [x] RX34 Legal/compliance readiness bundle
- [x] RX35 Closed beta + balancing gate
- [x] Final convergence gate for pre-release program

Pre-release program evidence refresh (2026-02-17):
- Targeted gameplay+readiness validation: `pnpm exec vitest run tests/cli.integration.test.ts -t "gameplay"` (`18/18` gameplay tests passing).
- Full verification gate: `pnpm verify` (`322/322` tests passing).
- Full release gate: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.
- Artifacts: `reports/doctor/doctor.json` (`generatedAt: 2026-02-17T14:53:49.568Z`), `reports/quality/ship-gate.summary.json` (`generatedAt: 2026-02-17T14:56:40.649Z`, `overall.ok: true`).
