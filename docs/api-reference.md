# API Reference

This project has two API surfaces:

1. CLI command contract (`runwright ...`).
2. Runtime HTTP API (`/v1/*`) used by the web runtime shell.

## CLI Contract

### High-value commands

- `runwright journey`
- `runwright update --json`
- `runwright scan --format json`
- `runwright apply --target all --scope project --mode copy --json`
- `runwright pipeline run --json`
- `runwright export --out release.zip --deterministic --json`
- `runwright verify-bundle --bundle release.zip --json`

### JSON output schemas

- `docs/schemas/cli/update-output.schema.json`
- `docs/schemas/cli/scan-output.schema.json`
- `docs/schemas/cli/apply-output.schema.json`
- `docs/schemas/cli/pipeline-output.schema.json`
- `docs/schemas/cli/export-output.schema.json`
- `docs/schemas/cli/verify-bundle-output.schema.json`

### Operation event schema

- `docs/schemas/operation-event.schema.json`

Run history is written to `.skillbase/operations.jsonl` with this schema.

## Runtime HTTP API

Runtime endpoints are implemented in `src/game/runtime.ts`.

### Versioning

- Current version: `1.0`
- Response header: `x-runwright-api-version`
- Version metadata endpoint: `GET /v1/meta/version`
- Governance policy: `docs/release/runtime-api-versioning-policy.md`

### Core endpoints

- `GET /v1/health`
- `GET /v1/metrics`
- `GET /v1/help`
- `GET /v1/release/readiness`
- `GET /v1/network/policy`

### Authentication and profile endpoints

- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/sessions`
- `GET /v1/profiles/:profileId`
- `PATCH /v1/profiles/:profileId/preferences`

### Gameplay and telemetry endpoints

- `POST /v1/saves`
- `GET /v1/saves/conflicts`
- `GET /v1/saves/:profileId/latest`
- `POST /v1/ranked/submit`
- `GET /v1/ranked/leaderboard`
- `POST /v1/telemetry/events`
- `GET /v1/analytics/funnel`
- `POST /v1/moderation/report`

## Compatibility and Enforcement

Use these commands to verify API and contract stability:

```bash
pnpm api:compat:runtime
pnpm vitest run tests/json-contract-schema.test.ts
```
