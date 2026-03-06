# Contributing to SkillSet by Runwright

Thanks for contributing. This project is optimized for correctness, reproducibility, and auditability.

## Development Setup

```bash
pnpm install
pnpm hooks:install
```

## Core Workflow

1. Create a branch for one logical change.
2. Keep scope minimal and reversible.
3. Add or update tests for every behavior change.
4. Run local quality gates before pushing.
5. Open a PR to `main` with clear problem, approach, and evidence.

## Branch Discipline

- Treat `main` as protected and PR-only.
- Direct pushes to `main` are blocked locally by `.githooks/pre-push` unless `RUNWRIGHT_ALLOW_MAIN_PUSH=1` is set for an approved break-glass case.
- Keep branches short-lived and delete them after merge.

## Required Quality Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

For release-level work, also run:

```bash
pnpm ci:local
pnpm ci:local:full
```

## Commit and PR Standards

- Use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- One logical change per commit.
- Include why the change exists, not just what changed.
- Keep generated artifacts and secrets out of commits.

## Tests and Contracts

- CLI behavior changes must include integration coverage in `tests/cli.integration.test.ts`.
- JSON output changes must update schema contracts in `docs/schemas/cli/` and `tests/json-contract-schema.test.ts`.
- User-facing help/error messaging changes should include `tests/help-ux.test.ts` or `tests/error-guidance-ux.test.ts` updates.

## Security and Responsible Disclosure

If you discover a security issue, follow the process in [SECURITY.md](SECURITY.md).

## Code of Conduct

Be respectful, direct, and evidence-driven in issues and PR discussions.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
