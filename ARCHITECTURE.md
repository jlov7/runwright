# Architecture — Runwright

## High-level view

Runwright is a CLI + library with 4 major subsystems:

1. **Resolver**: reads manifest, resolves sources → concrete skill directories.
2. **Store**: caches canonical copies in a local store with metadata.
3. **Adapters**: materialize each skill into agent-specific locations (link/copy/mirror).
4. **Scanner**: validates and security-scans skills.

Everything is **idempotent**: desired state is computed, then a plan is applied atomically.

## Key design constraints

- Many tools scan multiple directories; duplicates waste context and cause ambiguity.
- Some tools have unstable symlink behavior; mode must be configurable per-agent.
- Skills are untrusted input; do not execute bundled scripts.
- Must work on macOS, Linux, and Windows.

## Components

### 1) CLI layer
- Argument parsing, config discovery, logging, exit codes.
- Supports:
  - `apply`, `doctor`, `scan`, `list`, `update`, `export`.

### 2) Config & state
- `skillbase.yml` — declarative desired state.
- `skillbase.lock.json` — exact resolved versions.
- `~/.skillbase/store/` — canonical cached skills.
- `~/.skillbase/state.json` — last apply summary for quick `status`.

### 3) Resolver
Inputs:
- manifest
- lockfile (optional)
Outputs:
- resolved “skill units” with:
  - name
  - source
  - version (commit/tag)
  - local path in store
  - compatibility (optional)
  - per-agent mode override (optional)

### 4) Store
- Each source gets a cache directory:
  - git clones OR downloaded archives
- Stores:
  - content digest (sha256)
  - source metadata
  - resolved version
  - skill list

### 5) Adapters
Each adapter implements:

- `discoverExisting()` (for doctor)
- `computeDesiredPlacement(skillUnit)` (paths)
- `applyPlan(plan, mode)` (atomic operations)
- `verify()` (post-conditions)

Adapters should be pure filesystem logic; no LLM calls.

### 6) Scanner
- `lint`: frontmatter validation (spec compliance), file size limits, path traversal checks.
- `security`: heuristics on SKILL.md + scripts.
- `sbom`: optional manifest of hashes for each file in each skill.

## Atomic apply strategy

Never partially apply changes.

Technique:

1. Build a plan: list operations (mkdir, symlink, copy, delete, replace).
2. Create a temp staging directory per target.
3. Write everything into staging.
4. Swap with rename (atomic on POSIX; best-effort on Windows).
5. Rollback on failure.

## Cross-platform notes

- Windows symlink creation may require admin/dev mode. Provide:
  - automatic fallback to copy mode,
  - explicit `--mode copy` for Cursor by default.
- Handle case-insensitive filesystem collisions.

## Extensibility

- New agent integration = implement a new adapter.
- New “source type” = implement resolver plugin:
  - GitHub repo
  - skills.sh URL
  - local path
  - zip file
  - Anthropic/OpenAI hosted skill

