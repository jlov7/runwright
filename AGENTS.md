# Runwright Working Agreements

## Mission
Ship a production-ready v1 with coherent end-to-end CLI journeys, strong quality gates, and release evidence.

## Scope Rules
- Do only what is required for v1 release readiness.
- Keep changes small and reviewable.
- Avoid refactors unless required for correctness or UX clarity.
- Before touching more than 5 files in one increment, stop and get approval.

## Daily Execution Loop
1. Select one milestone task.
2. Implement minimal-risk change.
3. Run verification commands.
4. Update `PLANS.md`, `RELEASE_CHECKLIST.md`, and `QUESTIONS.md`.
5. Commit with a clear, scoped message.

## Standard Commands
- Install: `pnpm install`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Build: `pnpm build`
- Full local gate: `pnpm verify`
- Ship gate: `pnpm ship:gate`
- Quality evidence: `pnpm quality:evidence:verify`

## Quality Bar For v1
- Critical logic changes include tests.
- User-facing CLI copy is explicit about next steps.
- Happy path and key failure states are covered by tests.
- README includes setup, run, test, deploy, and env var notes.
- No secrets committed; input validation and safe errors remain enforced.
- Release artifacts remain deterministic and verifiable.

## Commit Rules
- Commit frequently, one logical change per commit.
- Message style: conventional commits with scope.
- Never commit secrets, credentials, or generated large artifacts.
