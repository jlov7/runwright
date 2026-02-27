# CLI Recipes

## See exactly what to do next
```bash
pnpm tsx src/cli.ts journey
```

## Start a new project
```bash
pnpm tsx src/cli.ts init
pnpm tsx src/cli.ts journey
pnpm tsx src/cli.ts update --json
pnpm tsx src/cli.ts scan --format json
pnpm tsx src/cli.ts apply --target all --scope project --mode copy --json
```

## Run the unified pipeline gate
```bash
pnpm tsx src/cli.ts pipeline run --json
```

## Enforce deterministic setup in CI
```bash
pnpm tsx src/cli.ts update --frozen-lockfile --json
pnpm tsx src/cli.ts apply --frozen-lockfile --target all --scope project --mode copy --json
```

## Export and verify a deterministic bundle
```bash
SOURCE_DATE_EPOCH=1704067200 pnpm tsx src/cli.ts export --out runwright-release.zip --deterministic --json
pnpm tsx src/cli.ts verify-bundle --bundle runwright-release.zip --json
```

## Export and verify with ed25519 signature
```bash
pnpm tsx src/cli.ts export --out runwright-release.zip --sign-private-key private.pem --deterministic --json
pnpm tsx src/cli.ts verify-bundle --bundle runwright-release.zip --sign-public-key public.pem --require-signature --json
```

## Troubleshoot policy exceptions
```bash
pnpm tsx src/cli.ts policy check --json
pnpm tsx src/cli.ts scan --format json --policy-decisions-out reports/policy-decisions.jsonl
```

## See command help quickly
```bash
pnpm tsx src/cli.ts help
pnpm tsx src/cli.ts <command> --help
```
