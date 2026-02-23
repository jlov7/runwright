# Release Gates (v1)

## How to use
- Run `pnpm run doctor` to collect local evidence into `reports/doctor/doctor.json`.
- Run `pnpm ci:local` before each push.
- Run `pnpm ci:local:full` before release cut.
- Mark a gate pass only when required evidence is present and current.

## Gate RG-001: Build & Static Quality
- Requirement: lint, typecheck, and build all pass.
- Evidence:
  - `reports/doctor/doctor.json` includes successful `lint`, `typecheck`, and `build` checks.
  - Local command: `pnpm run doctor`

## Gate RG-002: Critical Logic & UX Flow Tests
- Requirement: test suite passes including key journey/help/error guidance flows.
- Evidence:
  - `reports/doctor/doctor.json` includes successful `test` check.
  - Existing test suites include:
    - `tests/cli.integration.test.ts`
    - `tests/journey-ux.test.ts`
    - `tests/help-ux.test.ts`
    - `tests/error-guidance-ux.test.ts`

## Gate RG-003: Accessibility Baseline (CLI UX)
- Requirement: primary journeys are fully keyboard-driven with clear actionable copy and help.
- Evidence:
  - `journey`, `help`, and error guidance tests pass via `pnpm doctor`.
  - Stale evidence detection is covered in journey UX tests (changed skills force pending `update`/`scan`/`apply` steps).
  - Text-mode hard failures are explicit (`Apply Failed`, `Bundle Verification Failed`) and covered by UX tests.
  - Docs/help page exists at `docs/help/README.md`.

## Gate RG-004: Performance Baseline
- Requirement: no obvious regressions in critical operations.
- Evidence:
  - Performance budget and trend checks pass in test suite via `pnpm doctor`.
  - Optional deep checks:
    - `pnpm test:perf`
    - `pnpm perf:snapshot`
    - `pnpm perf:trend:check -- --current reports/performance/current.snapshot.json --baseline docs/benchmarks/performance-baseline.json --max-regression-percent 40 --out reports/performance/trend.report.json --history-dir reports/performance/history`

## Gate RG-005: Security Hygiene
- Requirement: dependency audit passes and safe boundary behavior remains tested.
- Evidence:
  - `reports/doctor/doctor.json` includes successful `audit:deps`.
  - Security-focused tests pass in `pnpm doctor` run (e.g. `tests/security-mutation.test.ts`, `tests/game-runtime-security-hardening.test.ts`).

## Gate RG-006: Documentation & Operability
- Requirement: release docs, setup/run/test/deploy notes, and env vars are complete.
- Evidence:
  - `README.md` includes setup/run/test/deploy/env sections.
  - Steering docs exist and are current:
    - `AGENTS.md`
    - `docs/internal/PLANS.md`
    - `docs/release/RELEASE_CHECKLIST.md`
    - `docs/internal/GAPS.md`
    - `docs/internal/QUESTIONS.md`

## Gate RG-007: Local CI Enforcement
- Requirement: local pre-push quality gate is enforced and passing.
- Evidence:
  - Hook path is set to `.githooks`: `git config --get core.hooksPath`
  - Hook installer command succeeds: `pnpm hooks:install`
  - Pre-push gate command succeeds: `pnpm ci:local`
  - Release-level local gate succeeds: `pnpm ci:local:full`

## Gate RG-008: Release Provenance & Attestation
- Requirement: release bundle provenance includes signed local attestation and successful verification.
- Evidence:
  - `pnpm release:attestation:generate -- --artifact <bundle.zip> --private-key <private.pem> --out <attestation.json>`
  - `pnpm release:attestation:verify -- --attestation <attestation.json> --artifact <bundle.zip> --public-key <public.pem> --out <attestation.verify.json>`
  - Manual workflow `release-verify.yml` includes both `release:attestation:generate` and `release:attestation:verify`.

## Gate RG-009: Runtime SLO Guard
- Requirement: runtime SLO thresholds pass for local launch gate.
- Evidence:
  - Policy: `docs/release/runtime-slo-policy.md`
  - Command: `pnpm runtime:slo:check`
  - Artifact: `reports/quality/runtime-slo.report.json`

## Gate RG-010: Runtime API Compatibility
- Requirement: runtime contract versioning and compatibility checks pass.
- Evidence:
  - Policy: `docs/release/runtime-api-versioning-policy.md`
  - Command: `pnpm api:compat:runtime`
  - Artifact: `reports/quality/runtime-api-compat.report.json`

## Gate RG-011: Frontend Copy & Interaction Consistency
- Requirement: critical UX copy and interaction guidance remain consistent across runtime shell updates.
- Evidence:
  - Command: `pnpm qa:copy:check`
  - Artifact: `reports/quality/frontend-copy-consistency.report.json`
