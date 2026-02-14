# Operator Runbook

## Purpose
Define the standard operating procedure for daily Runwright operation and release-readiness validation.

## Daily health checks
1. Run `pnpm verify`.
2. Run `pnpm audit:deps`.
3. Run `pnpm ship:gate`.
4. Confirm evidence artifacts exist in `reports/quality/`.

## Pre-release checklist
1. Ensure CI `quality-scorecard` and `release-verify` workflows are green.
2. Confirm release tag signature verification is `ok: true` for tagged releases.
3. Confirm `release-artifact-manifest.verify.json` is `ok: true`.
4. Confirm `release-notes.md` includes gate and artifact summaries.

## On-call diagnostics
1. Inspect `reports/quality/ship-gate.summary.json` for failing stage IDs.
2. Inspect `reports/quality/ship-gate.evidence.verify.json` for exact gate failures.
3. Inspect `reports/performance/trend.report.json` for regression deltas.
4. Inspect `.skillbase/operations.jsonl` for command-level mutation history.

## Escalation criteria
- Any signature/attestation verification failure.
- Any lockfile or bundle integrity failure on trusted artifacts.
- Any policy check finding that moves from suppressed to unresolved unexpectedly.
