# Overnight Program: Next-Level Hard Features

## Goal
Implement six advanced capabilities in one tracked, methodical execution pass with evidence, tests, and release-grade verification.

## Feature Set
1. Team Registry + Signed Sync
2. Crash-Resumable Apply Engine
3. Policy-as-Code Rule Packs
4. Interactive Remediation Flow
5. Continuous Drift Watch Mode
6. Release Provenance + Attestation Pipeline

## Execution Rules
- One feature at a time.
- Keep each code increment small and reviewable.
- Add/extend tests for each behavior change.
- Run targeted tests first, then full gates.
- Commit each feature as one logical unit.

## Exhaustive Task Matrix

### F1: Team Registry + Signed Sync
- [x] Define registry artifact schema (`bundle path`, `digest`, `signature`, `publishedAt`, `sourceRef`).
- [x] Add signed registry push command path.
- [x] Add signed registry pull command path with digest+signature verification.
- [x] Add error UX for missing keys, bad signatures, stale/unknown artifacts.
- [x] Add integration tests for push/pull happy path and signature failure.

### F2: Crash-Resumable Apply Engine
- [x] Define apply journal schema (`phase`, `target`, `backupDir`, `stagingDir`, `timestamp`).
- [x] Persist journal before mutating filesystem and clear on success.
- [x] Add recovery command to resume/rollback incomplete apply transactions.
- [x] Add startup-safe guidance when stale journal exists.
- [x] Add integration tests for interrupted apply recovery.

### F3: Policy-as-Code Rule Packs
- [ ] Add external policy pack input format (JSON rules file) and parser.
- [ ] Merge manifest rules + external pack deterministically.
- [ ] Evaluate rule packs with trace output and conflict-safe ordering.
- [ ] Add CLI UX/docs for running policy checks with a pack.
- [ ] Add tests for deterministic merges, deny/warn decisions, invalid pack errors.

### F4: Interactive Remediation Flow
- [ ] Add guided remediation command with non-interactive fallback.
- [ ] Support scan/policy/doctor issues as remediation candidates.
- [ ] Add explicit preview/apply confirmation flow with safe defaults.
- [ ] Ensure clear keyboard/terminal UX copy for non-technical operators.
- [ ] Add integration tests for guided and non-interactive modes.

### F5: Continuous Drift Watch Mode
- [ ] Add watch command to monitor manifest/skills/lockfile changes.
- [ ] Implement debounce + dedupe to avoid noisy reruns.
- [ ] Run update -> scan -> dry-run/apply pipeline in watch mode.
- [ ] Add safe failure recovery in watch loop (never crash on one run failure).
- [ ] Add tests for watcher triggering and debounce behavior.

### F6: Release Provenance + Attestation Pipeline
- [ ] Define attestation schema (`subject`, `digest`, `builder`, `run metadata`, `timestamp`).
- [ ] Generate attestation artifact from export outputs.
- [ ] Verify attestation integrity + signature.
- [ ] Add CLI/script UX for attestation generate/verify.
- [ ] Add tests for valid attestation + tamper detection.

## Verification Gates
- Targeted: feature-specific test files.
- Full: `pnpm verify`.
- Evidence: `pnpm run doctor`, `pnpm quality:evidence:verify`.
- Release hardening: `pnpm ship:gate`.

## Status Ledger
- Started: 2026-02-15
- Current phase: F3 policy-as-code rule packs
- Completion target: all six features implemented + verified locally
