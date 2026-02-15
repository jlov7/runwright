# Release Checklist (v1)

## Core Journeys
- [x] Happy-path user journeys are coherent end-to-end.
- [x] Key failure states are handled with clear recovery guidance.
- [x] User-facing copy is clear and actionable.

## Onboarding
- [x] First-run onboarding is implemented.
- [x] Empty states are implemented.
- [x] Progressive disclosure is implemented (clear next action).

## Help
- [x] In-app help/tooltips are implemented (CLI help/journey guidance).
- [x] Minimal docs/help page exists and is linked from primary docs.

## Quality Gates
- [x] Critical logic has automated tests.
- [x] Key UX flows have automated tests.
- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] CI is green for required checks.

## Accessibility Basics
- [x] Primary flows are keyboard-only navigable (CLI-first interactions).
- [x] Focus/interaction affordances are sensible for terminal usage.
- [x] Labels/aria equivalent clarity exists in CLI output and docs where relevant.

## Performance Basics
- [x] No obvious slow user-facing flows.
- [x] Unnecessary rework/re-renders avoided in current architecture.
- [x] Bundle/runtime footprint remains reasonable for stack.

## Security Hygiene
- [x] No secrets are committed to repository history for this release work.
- [x] Inputs are validated at command boundaries.
- [x] Error handling remains safe and actionable.
- [x] Auth/signing boundaries are respected where applicable.

## Documentation
- [x] README includes local setup instructions.
- [x] README includes run commands.
- [x] README includes test/verification commands.
- [x] README includes deploy/release notes.
- [x] README includes required/optional environment variables.

## Latest Evidence (2026-02-15)
- [x] Latest ship gate run is green: `pnpm ship:gate` (`reports/quality/ship-gate.summary.json` generated `2026-02-15T17:50:36.047Z`, `overall.ok: true`).
- [x] Signup/onboarding/first-success/core-loop/error journeys were audited and UX copy/help hints were improved in `src/cli.ts`.
- [x] Lightweight UX tests were updated for touched journeys in `tests/journey-ux.test.ts`, `tests/help-ux.test.ts`, and `tests/error-guidance-ux.test.ts`.
- [x] Verification commands passed: `pnpm vitest run tests/journey-ux.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts`, `pnpm vitest run tests/cli.integration.test.ts`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm run doctor`.
- [x] Deep multi-persona product + backend scorecards were completed and recorded in `docs/audits/2026-02-14-product-and-backend-scorecard.md`.
- [x] Latest local gate reruns are green: `pnpm verify` (291/291 tests) and `pnpm run doctor` (`reports/doctor/doctor.json` generated `2026-02-15T17:48:04.143Z`, `overall.ok: true`).
- [x] `pnpm quality:evidence:verify` now works without manual CLI arguments and is covered by script tests.
- [x] Onboarding journey step 2 now emits a copy-paste-safe skill scaffolding command (`skills/example-skill`) with regression coverage in `tests/journey-ux.test.ts`.
- [x] `scripts/verify_quality_evidence.ts` now fails fast on unknown flags and missing flag values with explicit messages; coverage added in `tests/quality-evidence-script.test.ts`.
- [x] `scripts/doctor.ts` now rejects unknown/malformed arguments with explicit errors; coverage added in `tests/doctor-script.test.ts`.
- [x] `runwright export --deterministic` now succeeds without env var across timezones via ZIP-safe timestamp clamping; edge cases are covered in `tests/cli.integration.test.ts`.
- [x] Journey optional verify-bundle guidance now expires on project changes and surfaces rerun guidance with coverage in `tests/journey-ux.test.ts`.
- [x] Release policy defaults are now explicit in `QUESTIONS.md` (GitHub artifacts required for v1, ed25519 signatures required for production releases).
- [x] `runwright init` is now idempotent-success on repeat runs with clear next-step copy and event mutating accuracy coverage in `tests/cli.integration.test.ts`.
- [x] Release scripts now support explicit help UX (`--help`/`-h`) for operator self-service in `scripts/doctor.ts` and `scripts/verify_quality_evidence.ts`, with tests.
- [x] `runwright watch` now supports continuous drift monitoring with `--once`, debounce controls, and `--apply-safe`, with integration tests in `tests/cli.integration.test.ts`.
- [x] Release provenance now includes signed local attestation generate/verify scripts (`release:attestation:generate`, `release:attestation:verify`), schema contracts, workflow integration, and tamper-detection tests.
