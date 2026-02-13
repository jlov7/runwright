# Test plan — Skillbase

## Test pyramid

### Unit tests (fast)
- Manifest parsing and schema validation
- Path normalization (POSIX + Windows)
- Planner: desired state → operations list
- Lockfile read/write + deterministic ordering
- Linter: frontmatter parsing, name rules

### Integration tests (filesystem)
Matrix:
- ubuntu-latest
- macos-latest
- windows-latest

Scenarios:
- link mode success
- copy mode success
- mirror mode (canonical → per-tool copy)
- broken symlink detection
- atomic swap behavior (best-effort Windows)
- case-insensitive collisions

Use fixtures:
- `fixtures/skills/valid/*`
- `fixtures/skills/invalid/*`
- `fixtures/agents/*` (fake tool directories)

### End-to-end (optional, local)
If CI environment has the tools available:
- run `codex` / `cursor` / `claude` in list/discovery mode to confirm installed skills are visible
(keep this optional to avoid flaky CI).

## Security tests
- corpus of known risky patterns in SKILL.md
- false-positive suite (legit commands)
- snapshot expected warnings and severity

## Regression tests
- “apply twice” idempotency test
- “update then apply” maintains lockfile invariants

## Observability
- structured logs for each operation
- `--json` output contract tests

