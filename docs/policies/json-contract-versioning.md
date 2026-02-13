# JSON Contract Versioning Policy

## Scope
This policy governs machine-readable JSON output contracts for Skillbase CLI commands used in automation.

Current schema contract version: `1.0`.

## Covered Commands
- `init --json`
- `doctor --json`
- `list --json`
- `apply --json`
- `update --json`
- `export --json`
- `verify-bundle --json`
- `scan --format json`
- `policy check --json`

## Compatibility Rules
- Every covered JSON payload MUST include `schemaVersion`.
- Patch-level/internal releases MUST NOT change existing key meanings.
- Adding optional keys is allowed in the same schema version.
- Removing keys, renaming keys, changing value types, or changing semantic meaning REQUIRES a schema version bump.
- Major behavioral or structural contract changes MUST ship with updated tests that fail on contract drift.

## Version Bump Guidance
- Keep `1.x` while maintaining backward-compatible payload semantics.
- Move to `2.0` when consumers must update parsers.
- Document schema changes in release notes and update integration tests in the same change.

## Contract Safety Gates
- Integration tests assert stable key-shapes for critical command JSON payloads.
- CI verification (`pnpm verify`) must be green before release.

## Operation Event Log
Mutating command executions append JSON lines to `.skillbase/operations.jsonl` by default.

Event fields:
- `schemaVersion`
- `timestamp`
- `command`
- `status`
- `durationMs`
- `mutating`
- optional `code`
- optional numeric `counters`

Use `SKILLBASE_OPERATION_LOG_PATH` to override the file path.
Set `SKILLBASE_OPERATION_LOG_PATH=off` to disable event logging.
