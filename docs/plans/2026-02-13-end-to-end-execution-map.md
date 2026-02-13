# Skillbase End-to-End Execution Map

## Goal
Ship Skillbase as a scrutiny-ready, enterprise-grade product with deterministic behavior, explicit policy semantics, auditable operations, and stable automation contracts.

## Program Completion Criteria
- All P0 and P1 capabilities are implemented and documented.
- `pnpm verify` and `pnpm audit:deps` are green.
- Contract tests detect JSON output drift.
- Security and policy behavior is explainable and traceable.

## Execution Backlog

### Track A: Policy & Security Governance
- [x] Stable scanner rule IDs and SARIF mapping
- [x] Global allow by rule ID (`allowRuleIds`)
- [x] Rule ID validation in manifest
- [x] Scoped policy allowlist with reason and expiry metadata
- [x] Rule severity overrides by rule ID
- [x] Policy decision traces in scan JSON output
- [x] `policy check` command for unresolved policy exceptions
- [x] Policy-decision export artifact mode for CI history

### Track B: Contracts & Observability
- [x] Versioned JSON contracts (`schemaVersion`)
- [x] Operation event log (`.skillbase/operations.jsonl`)
- [x] Contract-shape integration tests for major commands
- [x] Compatibility replay tests with versioned fixture outputs
- [x] Published JSON versioning policy
- [x] Event schema publishing + example fixtures

### Track C: Reproducibility & Provenance
- [x] Strict lockfile parser and frozen lockfile gates
- [x] Bundle verification guardrails (pre-inflate abuse checks)
- [x] Signed bundle verification path
- [x] Lockfile schema version migration playbook
- [x] Asymmetric signing option for bundles
- [x] Export provenance metadata extensions

### Track D: Reliability & Scale
- [x] Idempotent apply behavior + tests
- [x] Large-bundle performance guard tests
- [x] Resolver cache churn benchmark tests
- [x] Long-run repeated apply stress tests
- [x] Property-based manifest/lockfile invariant tests

### Track F: Audit Evidence
- [x] SBOM generation command and CI artifact publishing
- [x] CI quality scorecard generation
- [x] CI and release quality-evidence verification gate enforcement
- [x] Release verification scorecard generation
- [x] Quality evidence schema contracts (scorecard + evidence verification)
- [x] Ship-gate artifact schema contracts (summary + stage logs)
- [x] Quality evidence policy documentation
- [x] Release artifact manifest + verification artifacts with schema contracts

### Track E: Platform Extensibility
- [x] Adapter structure for codex/claude/cursor
- [x] Adapter contract harness for future adapters
- [x] Source-provider contract harness
- [x] Extension author documentation

### Track G: Portability Hardening
- [x] Replace machine-specific absolute test runner paths with repository-relative execution harness
- [x] Remove POSIX-only adapter contract path assumptions for cross-platform CI parity

### Track H: Governance and Operational Readiness
- [x] Governance foundation files (`LICENSE`, `CODEOWNERS`, support policy)
- [x] Versioning/deprecation and disclosure SLA policy enforcement tests
- [x] Operator runbook, incident playbook, failure-mode catalog, and break-glass procedure
- [x] External scrutiny program artifacts and issue templates

### Track I: Compatibility, Performance, and Soak Automation
- [x] Manifest/lockfile fixture-driven migration compatibility matrix with CI gate
- [x] Reliability soak workflow with repeated ship-gate artifact diff verification
- [x] Performance snapshot/trend tooling and CI regression-delta gate
- [x] Release tag-signature verification and release-note generation automation

## Current Wave (Autonomous Implementation)
1. Completed Track A/B/C/D/E P0/P1 execution items.
2. Backfilled tests and docs for all completed capabilities.
3. Re-ran full quality gates.

## Verification Gate (required)
- `pnpm verify`
- `pnpm audit:deps`
