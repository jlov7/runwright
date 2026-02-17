# World-Class Release Expansion Program (Execution Tracker)

## Goal
Execute the full post-v1 pre-release expansion backlog required for a five-star public launch quality bar.

## Source of Truth
- Primary tracker: this file
- Operational queue: `TODO.md`
- Release gate mapping: `RELEASE_GATES.md`
- Gap evidence: `GAPS.md`

## Program Rules
- Work in small increments with deterministic outputs.
- Keep each implementation increment to five files or fewer.
- After each increment: run targeted tests, then `pnpm verify`.
- After each milestone: run `pnpm run doctor`, `pnpm quality:evidence:verify`, and `pnpm ship:gate`.
- Every task needs code/docs/tests evidence before being marked complete.

## Backlog (40 items)

### Platform, Reliability, and Security
- [ ] WRX-001 CI hardening: required workflows always run and report deterministic step-level failures (no empty-step exceptions).
- [x] WRX-002 Runtime persistence migration from local file storage to production-grade database with migrations.
- [x] WRX-003 Full auth system (email/OAuth/session lifecycle/password reset/device revocation).
- [x] WRX-004 Account linking and cross-device identity merge flow.
- [x] WRX-005 Authoritative server validation for ranked/progression writes.
- [x] WRX-006 Matchmaking orchestration (MMR + region/latency aware queueing + reconnect rules).
- [x] WRX-007 Durable cloud save with conflict resolution UX and audit history.
- [x] WRX-008 Anti-cheat pipeline (anomaly detection + moderation hooks + ban state model).
- [x] WRX-009 Telemetry ingestion hardening with event contract validation and delivery guarantees.
- [x] WRX-010 Crash reporting pipeline with diagnostics envelope and redaction guarantees.
- [ ] WRX-011 CI-enforced performance budgets (startup, frame time, memory, bundle size).
- [ ] WRX-012 Security hardening pass (dependency posture, provenance, tamper-evident release proof).

### Product UX, Accessibility, and Localization
- [ ] WRX-013 Adaptive onboarding funnel optimization for first 10-minute activation.
- [ ] WRX-014 Contextual tutorial hint pacing improvements tied to player behavior.
- [ ] WRX-015 Full failure/recovery UX matrix with explicit next-action guidance per failure mode.
- [ ] WRX-016 Cross-flow empty-state polish for non-technical and technical personas.
- [x] WRX-017 Complete accessibility surface (input remap, text scale, contrast, reduced motion, SR clarity).
- [x] WRX-018 Localization framework maturity (message formatting/fallback/coverage reporting).
- [x] WRX-019 Offline/degraded-network queue behavior with deterministic replay and reconciliation.
- [ ] WRX-020 Game feel and feedback timing polish for premium interaction quality.

### Gameplay Depth and Retention
- [ ] WRX-021 Progression economy balancing framework with tunable reward curves.
- [ ] WRX-022 Boss encounter depth (telegraphs, phases, counters, reward clarity).
- [ ] WRX-023 Replay/ghost sharing portability with integrity checks.
- [ ] WRX-024 Challenge authoring templates with quality validation pipeline.
- [ ] WRX-025 Procedural challenge quality constraints (novelty/repetition/solvability).
- [ ] WRX-026 Adaptive difficulty guardrails for fairness and anti-frustration.
- [ ] WRX-027 Social graph maturity (friends/party/invite/block/mute privacy boundaries).
- [ ] WRX-028 Co-op session orchestration improvements (join/leave/reconnect fault handling).
- [ ] WRX-029 Ranked integrity hardening (authoritative scoreboard + anti-inflation controls).
- [ ] WRX-030 LiveOps controls expansion (rotation/reward/expiry/operator override).

### UGC, Moderation, and Operations
- [ ] WRX-031 Creator moderation lifecycle (review queue/state transitions/appeals).
- [ ] WRX-032 UGC discovery/ranking quality signals and abuse weighting.
- [x] WRX-033 Abuse reporting workflow hardening with triage SLAs and escalation paths.
- [x] WRX-034 Analytics dashboard maturity (funnels, retention, mode health, balancing visibility).
- [ ] WRX-035 QA automation matrix expansion (device/OS/locale/network profile coverage).
- [ ] WRX-036 Release pipeline maturity (staged rollout controls + instant rollback).
- [ ] WRX-037 On-call runbooks and incident response playbooks for live operations.
- [ ] WRX-038 App-store readiness pack completion (metadata, media, policy artifacts).
- [ ] WRX-039 Legal/compliance readiness pass (ToS, privacy, age-rating, consent paths).
- [ ] WRX-040 Closed beta operations and launch-candidate freeze criteria.

## Milestones
- [ ] M0 Establish exhaustive tracker + TODO mapping + verification baseline.
- [ ] M1 Core reliability/security foundations (WRX-001 to WRX-012).
- [ ] M2 UX/a11y/localization/offline hardening (WRX-013 to WRX-020).
- [ ] M3 Gameplay depth and retention systems (WRX-021 to WRX-030).
- [ ] M4 UGC/moderation/ops/release governance (WRX-031 to WRX-040).
- [ ] M5 Final full-gate convergence and release evidence refresh.

## Evidence Log
- 2026-02-17: Program initialized and linked to active TODO queue.
- 2026-02-17: WRX-006 implemented via `runwright gameplay matchmaking` with persisted queue tickets, region/latency estimation, reconnect policy guidance, and integration test coverage.
- 2026-02-17: WRX-033 implemented via moderation report severity/SLA metadata and `triage`/`escalate` action support with integration coverage.
- 2026-02-17: WRX-034 implemented by upgrading telemetry output with computed funnel completion, recovery rates, drop-off risk, and weighted mode health analytics.
- 2026-02-17: WRX-019 implemented via offline sync mutation queueing and deterministic queued-replay flush behavior when network mode returns online.
- 2026-02-17: WRX-017 implemented by extending accessibility controls with explicit text-scale and remap profile overrides in addition to preset-based configuration.
- 2026-02-17: WRX-018 implemented via locale coverage scoring and explicit fallback-chain reporting for unsupported locale requests.
- 2026-02-17: WRX-002/003/004/005/007/008/009/010 implemented in runtime via migration-aware persistence metadata, auth lifecycle/link-merge routes, conflict audit records, anti-cheat decision logging, telemetry dedupe receipts, and crash payload redaction.
