# Help Center

Use this page as the central index for operator help.

## Fastest unblocking command

```bash
pnpm tsx src/cli.ts journey
```

`journey` shows current onboarding status and the single next best action.
It also detects stale evidence: if skills or manifest changed after `update`/`scan`/`apply`, those steps return to pending until rerun.

## Common diagnostics
- `pnpm tsx src/cli.ts policy check --explain --json` (policy + trust reasoning)
- `pnpm tsx src/cli.ts fix --plan --json` (safe remediation plan)
- `pnpm tsx src/cli.ts scan --refresh-sources` (re-resolve remote sources)

## Help topics
- Command recipes: `docs/help/cli-recipes.md`
- Failure recovery: `docs/help/troubleshooting.md`
- Game runtime shell: `docs/help/game-runtime.md`
- Technical onboarding: `docs/getting-started/quickstart.md`
- Non-technical onboarding: `docs/getting-started/non-technical-onboarding.md`

## In-app help
- `pnpm tsx src/cli.ts help`
- `pnpm tsx src/cli.ts help <command>`
- `pnpm tsx src/cli.ts <command> --help`
