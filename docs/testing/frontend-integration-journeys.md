# Frontend Integration Journey Matrix

Date: 2026-02-19

## Journey coverage
- Onboarding happy path and first success: `tests/frontend-journey-e2e.test.ts`
- Core loop (challenge/campaign/creator/ranked): `tests/frontend-journey-e2e.test.ts`, `tests/frontend-runtime-contract.test.ts`
- Error recovery (invalid JSON, anti-tamper, sync conflict, route errors): `tests/game-runtime-failure-injection.test.ts`
- Runtime shell structure and static serving: `tests/game-runtime-shell.test.ts`

## Failure-state expectations
- Every failure payload includes actionable `nextAction` guidance.
- Ranked failure and sync conflict paths are explicitly asserted in tests.
- Recovery docs link remains reachable from shell and runtime help API.

## Execution commands
- `pnpm vitest run tests/frontend-journey-e2e.test.ts`
- `pnpm vitest run tests/frontend-runtime-contract.test.ts`
- `pnpm vitest run tests/game-runtime-failure-injection.test.ts`
