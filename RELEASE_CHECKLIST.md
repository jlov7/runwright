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
- [ ] CI is green for required checks.

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
