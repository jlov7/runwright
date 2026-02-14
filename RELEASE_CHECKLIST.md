# Release Checklist (v1)

## Core Journeys
- [ ] Happy-path user journeys are coherent end-to-end.
- [x] Key failure states are handled with clear recovery guidance.
- [x] User-facing copy is clear and actionable.

## Onboarding
- [x] First-run onboarding is implemented.
- [x] Empty states are implemented.
- [x] Progressive disclosure is implemented (clear next action).

## Help
- [x] In-app help/tooltips are implemented (CLI help/journey guidance).
- [ ] Minimal docs/help page exists and is linked from primary docs.

## Quality Gates
- [ ] Critical logic has automated tests.
- [x] Key UX flows have automated tests.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] CI is green for required checks.

## Accessibility Basics
- [ ] Primary flows are keyboard-only navigable (CLI-first interactions).
- [ ] Focus/interaction affordances are sensible for terminal usage.
- [ ] Labels/aria equivalent clarity exists in CLI output and docs where relevant.

## Performance Basics
- [ ] No obvious slow user-facing flows.
- [ ] Unnecessary rework/re-renders avoided in current architecture.
- [ ] Bundle/runtime footprint remains reasonable for stack.

## Security Hygiene
- [ ] No secrets are committed to repository history for this release work.
- [ ] Inputs are validated at command boundaries.
- [ ] Error handling remains safe and actionable.
- [ ] Auth/signing boundaries are respected where applicable.

## Documentation
- [ ] README includes local setup instructions.
- [ ] README includes run commands.
- [ ] README includes test/verification commands.
- [ ] README includes deploy/release notes.
- [ ] README includes required/optional environment variables.
