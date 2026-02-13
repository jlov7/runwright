# Skillbase World-Class Task List

## Prioritization Model
- P0: Blockers for trust, security, reproducibility.
- P1: Core product quality and operator ergonomics.
- P2: Scale, enterprise governance, and ecosystem expansion.

## Phase 1 (P0): Policy Engine Foundation
### Goal
Make scan and enforcement semantics stable, explainable, and policy-driven.

### Tasks
- [x] Define stable security scanner rule IDs and expose them in JSON findings.
- [x] Switch SARIF rule IDs to stable scanner IDs (not message slugs).
- [x] Extend manifest schema with security allowlist (`defaults.scan.allowRuleIds`).
- [x] Apply allowlist suppression in `scan` and `apply` scan paths.
- [x] Add regression tests for allowlisted risky fixtures.
- [x] Add contract tests for stable finding IDs and SARIF mapping.

### Definition of done
- Suppressed findings are deterministic and documented.
- Existing scan behavior unchanged when allowlist is absent.
- CI green on all tests.

## Phase 2 (P0/P1): Observability and Contracts
### Goal
Raise operability and audit confidence for teams and CI.

### Tasks
- [x] Introduce structured operation event log (JSONL) for mutating commands.
- [x] Record command, result code, duration, and key counters.
- [x] Add output schema snapshot tests for `scan`, `apply`, `update`, `verify-bundle`.
- [x] Publish machine-readable JSON Schema files for core CLI JSON outputs.
- [x] Validate command JSON payloads against schemas in CI tests.
- [x] Publish schema versioning policy.

### Definition of done
- Operators can reconstruct command outcomes from logs.
- Any JSON contract drift fails tests.

## Phase 3 (P1): Policy Enforcement Depth
### Goal
Move from heuristic scanning to configurable governance.

### Tasks
- [x] Add severity overrides by rule ID.
- [x] Add scoped allowlist (`by source`, `by skill`, `expiresAt`, `reason`).
- [x] Add `policy check` command that reports unresolved risk acceptances.
- [x] Add policy-decision traces to scan JSON.

### Definition of done
- Policy decisions are transparent and explainable.
- CI policies can be encoded without custom wrappers.

## Phase 4 (P1): Reproducibility and Provenance
### Goal
Tighten supply-chain trust boundaries.

### Tasks
- [x] Formalize lockfile schema versioning + migration policy.
- [x] Add signed release artifact verification flow.
- [x] Add optional stronger bundle signature mode (asymmetric signing path).
- [x] Add provenance metadata in export manifest.
- [x] Bind ed25519 signatures to signer identity via manifest `signature.keyId` fingerprint.
- [x] Enforce secret-backed release signing keys in CI and publish checksum + verify artifacts.
- [x] Add signed CI artifact provenance attestations for release bundles.
- [x] Add deterministic export mode (`--deterministic`, `SOURCE_DATE_EPOCH`) for reproducible release artifacts.
- [x] Add consumer verification script for release bundle checksum/signature validation with attestation support.

### Definition of done
- Version upgrades are predictable and test-backed.
- Artifact provenance is verifiable in automation.

## Phase 5 (P1/P2): Reliability and Performance
### Goal
Guarantee predictable behavior at larger skill counts.

### Tasks
- [x] Add performance guard tests for large valid bundles.
- [x] Add resolver cache churn benchmarks.
- [x] Add stress tests for repeated idempotent apply cycles.
- [x] Add explicit export/verify performance budget file with median-based guard tests.
- [x] Add parser and bundle-verification fuzz resilience corpus tests.
- [x] Add mutation-style scanner corpus to reduce heuristic false negatives.
- [x] Add deterministic differential fuzzing job with minimized mismatch artifacts.
- [x] Add mutation-testing gate (Stryker) with CI-enforced thresholds (`break >= 85`, `high >= 90`) and focused non-static mutators.
- [x] Add property-based tests for manifest/lockfile invariants.
- [x] Add compatibility replay tests with versioned fixture outputs.

### Definition of done
- Performance regressions are detected pre-merge.
- No reproducibility regressions under stress fixtures.

## Phase 6 (P2): Platform Expansion
### Goal
Scale ecosystem coverage without destabilizing core contracts.

### Tasks
- [x] Add adapter contract test harness reusable by new adapters.
- [x] Add source-provider plugin contract tests.
- [x] Expand documentation for third-party adapter/source development.

### Definition of done
- New adapters/sources can be added with a stable certification workflow.

## Phase 7 (P1/P2): Audit Evidence and Governance
### Goal
Make every release externally auditable with reproducible quality evidence artifacts.

### Tasks
- [x] Add CycloneDX SBOM generation command and CI artifact publishing.
- [x] Add CI quality scorecard artifact generation summarizing all major gates.
- [x] Add quality evidence verification gate script and CI/release workflow enforcement.
- [x] Add release verification scorecard artifact generation.
- [x] Add JSON schemas for quality scorecard and evidence-verification payloads.
- [x] Add JSON schemas for ship-gate summary and stage-log payloads.
- [x] Update security and quality evidence policies to reflect current controls.
- [x] Remove machine-specific absolute test runner paths; enforce repository-relative harness execution for cross-platform CI.
- [x] Add governance files (`LICENSE`, `CODEOWNERS`, `SUPPORT.md`) with policy enforcement tests.
- [x] Add fixture-driven manifest/lockfile migration compatibility matrix and CI enforcement job.
- [x] Add reliability soak automation with repeated ship-gate artifact consistency checks.
- [x] Add performance snapshot/trend regression tooling with CI artifact publication.
- [x] Enforce signed release tag verification and immutable release artifact manifest verification.
- [x] Add release-note generation artifact tied to scorecard/evidence outputs.
- [x] Publish operator docs: runbook, incident playbook, failure-mode catalog, break-glass procedure, external scrutiny loop.

### Definition of done
- Each CI and release run emits machine-readable evidence suitable for external review.

## Execution Plan for This Session
1. Implement all Phase 1 tasks.
2. Update README contract bullets.
3. Run `pnpm verify` and `pnpm audit:deps`.
