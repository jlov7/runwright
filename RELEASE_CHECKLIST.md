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

## Latest Evidence (2026-02-14)
- [x] Signup/onboarding/first-success/core-loop/error journeys were audited and UX copy/help hints were improved in `src/cli.ts`.
- [x] Lightweight UX tests were updated for touched journeys in `tests/journey-ux.test.ts`, `tests/help-ux.test.ts`, and `tests/error-guidance-ux.test.ts`.
- [x] Verification commands passed: `pnpm vitest run tests/journey-ux.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts`, `pnpm vitest run tests/cli.integration.test.ts`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm run doctor`.
- [x] Deep multi-persona product + backend scorecards were completed and recorded in `docs/audits/2026-02-14-product-and-backend-scorecard.md`.
- [x] Latest local gate reruns are green: `pnpm verify` (248/248 tests) and `pnpm run doctor` (`reports/doctor/doctor.json` generated `2026-02-14T22:34:07.685Z`, `overall.ok: true`).
- [x] `pnpm quality:evidence:verify` now works without manual CLI arguments and is covered by script tests.
