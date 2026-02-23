# Runtime API Versioning Policy (v1)

## Version Contract
- Current API version: `1.0`
- Minimum supported version: `1.0`
- Compatibility window: `v1.x`

Runtime responses include `x-runwright-api-version`, and `GET /v1/meta/version` returns version metadata for automated compatibility checks.

## Governance Rules
- Additive, non-breaking response fields are allowed within `v1.x`.
- Breaking contract changes require a major version bump and migration notes.
- Legacy consumers must continue to work across all `v1.x` releases.

## Enforcement Command
- `pnpm api:compat:runtime`

This command writes `reports/quality/runtime-api-compat.report.json` and exits nonzero if version/header/contract-shape checks fail.
