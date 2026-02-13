# Skillbase World-Class Product Blueprint

## Objective
Transform Skillbase from a strong CLI MVP into a trusted, enterprise-ready skills control plane for multi-agent development environments.

## Product Standard
A world-class Skillbase must be:
- Deterministic: same inputs produce same installs and scans across platforms.
- Secure by default: untrusted skills cannot silently bypass policy.
- Auditable: every state change and policy decision is machine-verifiable.
- Operable: clear SLOs, diagnostics, and low-friction incident response.
- Extensible: adapters, source resolvers, and policy packs evolve without breaking consumers.

## Product Scope (v1)
### Core value
- Single manifest and lockfile to manage skills across Codex, Claude Code, and Cursor.
- Reproducible installs with frozen lockfile semantics.
- Portable bundles with provenance verification.
- Policy enforcement that can run in local dev and CI.

### Non-goals for v1
- Marketplace economics and monetization flows.
- Executing skill scripts.
- Full hosted control plane UI.

## World-Class Capability Requirements
### 1) Product & UX
- Stable command contracts and machine-readable JSON schemas.
- Predictable, non-interactive automation mode for CI and platform teams.
- Explicit, actionable remediation messages for every failure class.
- First-class dry-run and explainability for all mutating operations.

### 2) Supply-chain & Security
- Strict manifest/lockfile schema and semantic validation.
- Trusted-source boundaries with symlink/path traversal defenses.
- Stable, versioned scanner rule IDs (no message-derived identifiers).
- Policy allowlist and risk-acceptance workflow by rule ID.
- Bundle integrity verification with pre-inflate archive abuse guardrails.
- Signed bundle verification with strict key handling.

### 3) Reliability & Determinism
- Idempotent apply and deterministic lockfile ordering.
- Atomic target apply with rollback semantics.
- Cross-platform path/case collision handling.
- Reproducible source resolution with explicit cache behavior.

### 4) Operability & Governance
- Structured diagnostics suitable for SIEM/analytics.
- CI quality gates with security scan artifacts (SARIF).
- Release quality bars: zero high vulnerabilities, full green verify gate.
- Versioned compatibility guarantees for CLI output and lockfile schema.

### 5) Extensibility
- Adapter interface stability and compatibility tests.
- Source resolver contract with strict validation and cache poisoning defenses.
- Policy engine abstraction supporting future org policy packs.

## Architecture Maturity Targets
### Current baseline
- Strong CLI contract with strict validation and broad integration tests.
- Bundle verification and frozen lockfile controls.
- Core scanner and SARIF output.

### Required next architecture layers
- Policy engine core:
  - Stable rule IDs.
  - Manifest-defined allowlist controls.
  - Deterministic suppression semantics.
- Observability core:
  - Structured operation events and policy decision traces.
- Compatibility layer:
  - Contract tests for JSON payloads and lockfile schema evolution.

## Quality & Risk Bar
### SLO-like targets
- `verify` pass rate in CI: >= 99.9% over rolling 30 days.
- Cross-platform integration parity: no untriaged OS-specific regressions.
- Security scanner false-negative tolerance: 0 known escaped high-risk fixtures.

### Release gates
- Lint/type/test/build all green.
- Dependency audit at high severity clean.
- Contract tests for JSON outputs and lockfile parser green.
- Security regression corpus green.

## Compliance Readiness (v1.5+)
- SOC2-ready audit evidence exports (operation log + policy decisions).
- Signed release artifacts and documented provenance.
- Formal threat model refresh each release quarter.

## Roadmap (phased)
- Phase 1: Policy engine foundation (stable IDs, allowlist semantics, SARIF stability).
- Phase 2: Observability and contract hardening (operation event log, schema snapshots).
- Phase 3: Enterprise controls (policy packs, approval workflows, stricter enforcement modes).
- Phase 4: Platform expansion (new adapters/sources and hosted control plane integration).

## Phase 1 Execution in This Session
Implement immediately:
1. Stable security rule IDs in scanner output and SARIF.
2. Manifest-configurable allowlist by rule ID.
3. Apply and scan integration for allowlist enforcement.
4. Tests for suppression behavior and contract stability.
