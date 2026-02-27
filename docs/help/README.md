# Help Center

Use this page as the central index for operator help.

## Fastest unblocking command

```bash
pnpm tsx src/cli.ts journey
```

`journey` shows current onboarding status and the single next best action.
It also detects stale evidence: if skills or manifest changed after `update`/`scan`/`apply`, those steps return to pending until rerun.

## Fastest web runtime orientation

```bash
pnpm game:runtime
```

Then open the runtime URL and follow:
1. First-run guide overlay (choose persona + start setup).
2. Guided onboarding actions in order (profile -> tutorial -> save -> publish).
3. `Take Me To Next Step` for one-click progression.
4. `Explore Advanced Surfaces` only after first-success (or when explicitly needed).

## Common diagnostics
- `pnpm tsx src/cli.ts policy check --explain --json` (policy + trust reasoning)
- `pnpm tsx src/cli.ts fix --plan --json` (safe remediation plan)
- `pnpm tsx src/cli.ts scan --refresh-sources` (re-resolve remote sources)
- `pnpm tsx src/cli.ts pipeline run --json` (single-command update -> scan -> apply gate)

## Help topics
- Command recipes: `docs/help/cli-recipes.md`
- Failure recovery: `docs/help/troubleshooting.md`
- Recovery playbooks: `docs/help/recovery-playbooks.md`
- Game runtime shell: `docs/help/game-runtime.md`
- Public showcase lanes: `apps/showcase` + `docs/testing/showcase-journey-tests.md`
- Technical onboarding: `docs/getting-started/quickstart.md`
- Non-technical onboarding: `docs/getting-started/non-technical-onboarding.md`

## In-app help
- `pnpm tsx src/cli.ts help`
- `pnpm tsx src/cli.ts help <command>`
- `pnpm tsx src/cli.ts <command> --help`
