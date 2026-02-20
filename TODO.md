# Five-star TODO (Post-v1)

## P0 (Active UX simplification world-class pass: 2026-02-20)
Tracker: `docs/plans/2026-02-20-ux-simplification-world-class-pass.md`

- [x] UXP-00 Capture baseline evidence and define phase tracker.
- [ ] UXP-01 Core-first nav model (`core` + `advanced`) and advanced toggle.
- [ ] UXP-02 Progressive disclosure defaults (first-run shows only core surfaces).
- [ ] UXP-03 Unlock hints/lock reasons for blocked advanced surfaces.
- [ ] UXP-04 Guided first-success strip with explicit current step.
- [ ] UXP-05 Onboarding action sequencing and rationale copy hardening.
- [ ] UXP-06 Empty-state/error/help copy simplification pass.
- [ ] UXP-07 Layout density reduction and hierarchy polish.
- [ ] UXP-08 Accessibility/focus/keyboard regression hardening for new flow.
- [ ] UXP-09 Frontend targeted suites + full `pnpm verify`.
- [ ] UXP-10 `pnpm run doctor` + release evidence doc refresh.

## Launch Sweep TODO (2026-02-21)
- [x] Create launch deployment plan document.
- [x] Run `pnpm verify`.
- [x] Run `pnpm run doctor`.
- [x] Run `pnpm ship:gate`.
- [x] Run `pnpm ship:gate -- --skip mutation --skip fuzz-differential`.
- [x] Run `pnpm quality:evidence:verify`.
- [x] Run `pnpm tsx scripts/verify_quality_evidence.ts --require-check verify --require-check audit --require-check sbom --require-check release-verify-local`.
- [x] Run `pnpm release:verify-local`.
- [x] Run `pnpm test:web-a11y`.
- [x] Run `pnpm test:visual`.
- [x] Run `pnpm perf:frontend:check`.
- [x] Run `pnpm perf:frontend:soak`.
- [x] Run `pnpm qa:frontend:matrix`.
- [x] Run `pnpm test:coverage`.
- [x] Run `pnpm test:fuzz-differential`.
- [x] Run `pnpm test:mutation`.
- [x] Run `pnpm ship:soak`.
- [x] Run live runtime smoke checks (`/v1/health`, `/v1/help`, `/v1/release/readiness`).
- [x] Refresh CI/CodeQL incident evidence for latest head.
- [x] Update release docs with final launch evidence and decision.

## P0 (Active world-class release expansion backlog)
- [x] Execute full 40-item program from `docs/plans/2026-02-17-world-class-release-expansion-program.md`
- [x] WRX-001 CI hardening and deterministic workflow execution
- [x] WRX-002 Production-grade runtime persistence and migration path
- [x] WRX-003 Full account/auth lifecycle
- [x] WRX-004 Cross-device identity linking/merge flow
- [x] WRX-005 Authoritative progression/ranked write validation
- [x] WRX-006 Matchmaking orchestration (MMR + latency/region + reconnect)
- [x] WRX-007 Durable cloud save with conflict audit trail
- [x] WRX-008 Anti-cheat anomaly detection and enforcement hooks
- [x] WRX-009 Telemetry ingestion validation and durability
- [x] WRX-010 Crash reporting pipeline with diagnostics redaction
- [x] WRX-011 CI-enforced performance budgets
- [x] WRX-012 Security hardening and release provenance closure
- [x] WRX-013 Adaptive first-10-minute onboarding optimization
- [x] WRX-014 Contextual tutorial hint pacing
- [x] WRX-015 Failure/recovery UX matrix completion
- [x] WRX-016 Empty-state/copy polish across personas
- [x] WRX-017 Complete accessibility support surface
- [x] WRX-018 Localization framework maturity and fallback correctness
- [x] WRX-019 Offline/degraded-network deterministic queue/replay
- [x] WRX-020 Premium game-feel feedback timing pass
- [x] WRX-021 Progression economy balancing framework
- [x] WRX-022 Boss encounter system deepening
- [x] WRX-023 Replay/ghost share portability with integrity checks
- [x] WRX-024 Challenge authoring templates + validation
- [x] WRX-025 Procedural generation quality constraints
- [x] WRX-026 Adaptive difficulty fairness guardrails
- [x] WRX-027 Social graph maturity (friends/party/block/mute/privacy)
- [x] WRX-028 Co-op join/leave/reconnect orchestration hardening
- [x] WRX-029 Ranked integrity hardening + anti-inflation controls
- [x] WRX-030 LiveOps controls expansion
- [x] WRX-031 Creator moderation lifecycle and appeals
- [x] WRX-032 UGC discovery/ranking quality signals
- [x] WRX-033 Abuse reporting workflow hardening
- [x] WRX-034 Gameplay analytics dashboard maturity
- [x] WRX-035 QA matrix automation expansion
- [x] WRX-036 Staged rollout + rollback operations maturity
- [x] WRX-037 On-call/incident playbook completion
- [x] WRX-038 App-store readiness pack
- [x] WRX-039 Legal/compliance readiness pass
- [x] WRX-040 Closed beta operations + launch-candidate freeze

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

## P0 (Additional pre-release gate world-class backlog: 40/40)
Tracker: `docs/plans/2026-02-17-pre-release-gate-world-class-backlog.md`

- [x] PRX-01 CI release-gate continuity
- [x] PRX-02 Release-candidate smoke flow
- [x] PRX-03 Runtime/client shell readiness
- [x] PRX-04 Auth lifecycle hardening
- [x] PRX-05 Account recovery boundary
- [x] PRX-06 Cloud save conflict policy
- [x] PRX-07 Unified progression consistency
- [x] PRX-08 Telemetry ingestion durability
- [x] PRX-09 Crash diagnostics redaction
- [x] PRX-10 Legal/privacy/compliance pack
- [x] PRX-11 First-10-minute onboarding
- [x] PRX-12 Contextual tutorial pacing
- [x] PRX-13 Failure recovery assistant
- [x] PRX-14 Campaign chaptering
- [x] PRX-15 Economy balancing simulator
- [x] PRX-16 Boss depth pass
- [x] PRX-17 Quest variety controls
- [x] PRX-18 Achievements and milestones
- [x] PRX-19 Daily/weekly challenge cadence
- [x] PRX-20 Replay editor/export path
- [x] PRX-21 Spectator mode baseline
- [x] PRX-22 Ghost ladder retention layer
- [x] PRX-23 Friends/party/invite flow
- [x] PRX-24 Co-op host migration/reconnect
- [x] PRX-25 Ranked integrity boundary
- [x] PRX-26 Anti-cheat enforcement visibility
- [x] PRX-27 Creator authoring guidance
- [x] PRX-28 UGC moderation + appeals
- [x] PRX-29 UGC discovery quality ranking
- [x] PRX-30 Seasonal LiveOps controls
- [x] PRX-31 Remote config experiments
- [x] PRX-32 In-app searchable helpdesk
- [x] PRX-33 Accessibility completeness
- [x] PRX-34 Controller profile support
- [x] PRX-35 Localization readiness/fallback
- [x] PRX-36 Offline-first sync replay
- [x] PRX-37 Performance budget enforcement
- [x] PRX-38 QA matrix + signoff criteria
- [x] PRX-39 Closed beta + balancing gate
- [x] PRX-40 Launch operations pack

## P0 (Frontend 100/100 execution program)
Tracker: `docs/plans/2026-02-19-frontend-100-score-execution-plan.md`

M0 task tracking:
- [x] PRG-01 Scoring rubric with evidence requirements (`docs/design/frontend-score-rubric.md`)
- [x] PRG-02 Objective 100/100 thresholds (`docs/design/frontend-score-rubric.md`)
- [x] PRG-03 Release dashboard page (`docs/release/frontend-release-dashboard.md`)
- [x] ARC-01 Architecture pattern locked (`docs/architecture/frontend-architecture-adr.md`)
- [x] ARC-02 Module boundary definition (`docs/architecture/frontend-architecture-adr.md`)
- [x] ARC-03 Frontend strict TypeScript enforcement in toolchain
- [x] ARC-04 Typed API client layer with shared contracts
- [x] TST-01 Frontend test strategy (`docs/testing/frontend-test-strategy.md`)

M1 task tracking:
- [x] ARC-05 State management strategy (`apps/web/src/app/state-store.ts`)
- [x] ARC-06 Reusable component foundation (`apps/web/src/shared/ui/primitives.ts`)
- [x] ARC-07 Component documentation/catalog (`docs/architecture/frontend-component-catalog.md`)
- [x] ARC-08 Architecture constraints/rules (`docs/architecture/frontend-boundary-rules.md`)
- [x] ARC-09 Static boundary enforcement (`eslint.config.mjs` restricted imports)
- [x] ARC-10 Maintainability merge checklist (`docs/release/frontend-maintainability-checklist.md`)
- [x] TST-02 Unit tests for UI primitives (`tests/frontend-ui-primitives.test.ts`)
- [x] TST-03 Unit tests for state logic (`tests/frontend-state-store.test.ts`)

Milestone tracking:
- [x] M0 Foundation/scoring/architecture baseline
- [x] M1 Frontend architecture modernization
- [x] M1 Frontend architecture modernization
- [x] M2 Design system + visual language
- [x] M3 IA + navigation + clarity
- [x] M4 Onboarding + first-success perfection
- [x] M5 Interaction quality + recovery UX
- [x] M6 Accessibility + mobile/responsive excellence
- [x] M7 Product surface completeness
- [x] M8 Performance + testing depth
- [x] M9 Final polish + panel rehearsal + release signoff

Workstream completion:
- [x] WS-01 Visual design language & brand polish
- [x] WS-02 Information architecture & clarity
- [x] WS-03 Onboarding / first-success journey
- [x] WS-04 Interaction quality
- [x] WS-05 Error handling & recovery UX
- [x] WS-06 Accessibility fundamentals
- [x] WS-07 Mobile/responsive quality
- [x] WS-08 Frontend architecture maintainability
- [x] WS-09 Performance basics
- [x] WS-10 Frontend testing depth
- [x] WS-11 Product completeness of core UI surfaces
- [x] WS-12 World-class feel / cohesion
- [x] WS-13 Program governance + release gates
