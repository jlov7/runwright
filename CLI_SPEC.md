# CLI spec — `runwright`

## Commands

### `runwright init`
- Generates a starter `runwright.yml` + `.gitignore` entries.
- Optional: `--from skills.json` (import from other tools).

### `runwright journey`
Shows onboarding progress and the single best next action based on current project state.

Flags:
- `--json`

### `runwright apply`
Ensures target tools have the desired skills installed.

Flags:
- `--mode link|copy|mirror` (override default)
- `--target codex|claude-code|cursor|all`
- `--scope global|project`
- `--dry-run`
- `--json`
- `--no-scan`
- `--scan-security off|warn|fail`
- `--fix` (apply safe repairs detected by doctor)

Exit codes:
- 0 success
- 2 partial (non-fatal warnings; only if not `--scan-security fail`)
- 10 invalid manifest
- 11 lockfile mismatch (when `--frozen-lockfile`)
- 20 filesystem error
- 30 scan failed (security mode = fail)

### `runwright doctor`
Detects problems:
- duplicate skills across multiple discovery paths
- broken symlinks
- invalid `SKILL.md`
- tool-specific known issues

Flags:
- `--fix`
- `--json`
- `--target ...`

### `runwright scan`
Runs lint + security scan without installing.

Flags:
- `--lint-only`
- `--security off|warn|fail`
- `--format text|json|sarif`
- `--policy-decisions-out <path>` (writes JSONL artifact of policy decisions)

JSON output includes:
- findings (with original/effective severity)
- policy decision traces
- suppression counts
- trust summary

### `runwright policy check`
Validates scan policy allowlist entries and reports unresolved exceptions.

Flags:
- `check` (required subcommand)
- `--format text|json`
- `--json`
- `--explain` (include policy decision trace)
- `--refresh-sources`
- `--remote-cache-ttl <seconds>`

Exit codes:
- 0 policy clean
- 2 unresolved policy exceptions found

### `runwright fix`
Plans or applies safe remediation steps for scan/policy/trust issues.

Flags:
- `--plan` (default)
- `--apply`
- `--json`
- `--refresh-sources`
- `--remote-cache-ttl <seconds>`

Exit codes:
- 0 plan generated or apply completed with no remaining actions
- 2 apply completed but actions remain
- 11 rollback triggered due to apply failure

### `runwright list`
Shows resolved skills by target.

### `runwright update`
Updates sources to latest matching policy.
- respects lockfile when `--frozen-lockfile`
- writes updated lockfile otherwise

### `runwright export`
Creates a zip bundle of:
- manifest
- lockfile
- skill contents
For air-gapped installs.

Flags:
- `--out <bundle.zip>`
- `--sign-key <path>` (HMAC signing)
- `--sign-private-key <path>` (ed25519 signing)
- `--deterministic` (stable archive metadata/timestamps for reproducible output)
- `--json`

Environment:
- `SOURCE_DATE_EPOCH` (Unix timestamp seconds) enables deterministic export timestamping (also honored via `SKILLBASE_SOURCE_DATE_EPOCH`).

## Output conventions

- Human output is concise and grouped by target.
- Error output includes recovery guidance (`Next:`) for common failure modes.
- Unknown commands/help topics include nearest-command suggestions when confidence is high.
- `--json` emits a stable machine schema:
  - plan summary
  - changed files
  - warnings/errors
  - installed skills

### `runwright verify-bundle`
Verifies bundle integrity and (optionally) signature.

Flags:
- `--bundle <bundle.zip>` (required)
- `--sign-key <path>` (for HMAC signed bundles)
- `--sign-public-key <path>` (for ed25519 signed bundles)
- `--require-signature`
- `--json`
