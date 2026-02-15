# Runwright Working Agreements

## Mission
Ship a production-ready v1 with coherent end-to-end CLI journeys, strong quality gates, and release evidence.

## Gap Loop (Strict)
1. Run baseline evidence collection with `pnpm run doctor`.
2. Read `RELEASE_GATES.md` and compare each gate against fresh artifacts.
3. Update `GAPS.md` with any failing/missing evidence as prioritized P0/P1/P2 gaps.
4. Pick the highest-priority unblocked gap and implement the smallest safe fix.
5. Run targeted checks first, then rerun `pnpm doctor`.
6. Update `GAPS.md` statuses and evidence links/commands.
7. Commit one logical change.
8. Repeat until stop conditions are met.

## Gap Loop Stop Conditions
- Stop only when all `RELEASE_GATES.md` gates are satisfied with fresh evidence from `reports/doctor/doctor.json` and latest branch CI is green (or RG-007 platform-incident exception path is explicitly satisfied and documented).
- If product decisions are missing, log them in `QUESTIONS.md`, mark the affected gap as blocked, and continue on remaining unblocked gaps.
- If external platform incidents block CI (for example step-less GitHub job startup failures), log incident evidence in `QUESTIONS.md`, mark the gap blocked in `GAPS.md`, and continue all non-blocked local work.
- Never stop after planning alone. Planning artifacts without implementation and verification are incomplete.

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
