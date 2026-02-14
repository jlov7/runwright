# Extension Authoring Guide

## Scope
This guide describes how to add new adapters and source providers without breaking Runwright contracts.

## Adapter Extensions
An adapter must provide:
- `name`
- `resolveInstallDir(scope, cwd, homeDir)`

Required behavior:
- Return absolute paths.
- Distinguish `project` and `global` scopes.
- End install path with `skills`.
- Keep paths deterministic for the same inputs.

Validation harness:
- `tests/adapters.contract.test.ts`
- helper: `tests/harness/adapterContractHarness.ts`

When adding a new adapter:
1. Add adapter implementation under `src/adapters/`.
2. Wire adapter into CLI adapter registry.
3. Add it to `tests/adapters.contract.test.ts` case list.
4. Run `pnpm test:contracts`.

## Source Provider Extensions
Runwright validates provider outputs with strict contracts through resolver checks.

Provider response requirements:
- `rootPath` must exist and be under managed store.
- `type` must match source key format.
- `resolvedRef` must be `commit` or `tag`.
- `resolvedValue` must be non-empty.
- optional `forcedPick` must be non-empty.

Validation harness:
- `tests/source-provider.contract.test.ts`

When adding a new provider:
1. Add source format parsing and provider logic.
2. Extend resolver validation if needed.
3. Add positive and negative provider contract tests.
4. Run `pnpm test:contracts`.

## Policy and Contract Safety
Before merging extension work:
- `pnpm verify`
- `pnpm audit:deps`
- ensure no JSON contract drift against `docs/policies/json-contract-versioning.md`

## Release Verification
Release artifact verification flow:
- workflow: `.github/workflows/release-verify.yml`
- verifies signed export bundles using ed25519 (`--sign-private-key` / `--sign-public-key`).
