# Task list — Runwright

This is written to map cleanly into GitHub Issues + PR-sized work.

## EPIC 0 — Project scaffolding
- [ ] Choose name, repo, license, code owners
- [ ] Set up CI (OS matrix)
- [ ] Set up formatting + linting + commit hooks
- [ ] Add docs templates (this folder)

## EPIC 1 — Manifest + lockfile
- [ ] Implement manifest parser (YAML + JSON)
- [ ] Define schema validation + friendly errors
- [ ] Implement lockfile writer (stable sort, deterministic)
- [ ] `init` command scaffolds manifest + defaults

Definition of done:
- invalid manifests produce actionable errors
- lockfile is deterministic across OS

## EPIC 2 — Skill discovery & store
- [ ] Define “source” interface:
  - github repo
  - local path
  - skills.sh URL (phase 2; can shell out to `npx skills`)
- [ ] Implement local store layout
- [ ] Implement caching and update checks
- [ ] Compute file digests

DoD:
- resolve a source → list skill directories inside it
- cache and re-use without re-downloading

## EPIC 3 — Adapters
### Codex adapter
- [ ] Implement path mapping (global vs project)
- [ ] apply plan (link + copy)
- [ ] verify installed skills exist

### Claude Code adapter
- [ ] Implement `.claude/skills` + `~/.claude/skills`
- [ ] apply plan (link + copy)
- [ ] verify

### Cursor adapter
- [ ] Implement `.cursor/skills` + `~/.cursor/skills`
- [ ] Default to copy mode
- [ ] Detect symlink issues, auto-fallback

DoD:
- for each adapter, integration tests pass on all OS

## EPIC 4 — Planner + atomic apply
- [ ] build desired-state graph
- [ ] compute minimal ops
- [ ] implement staging + atomic swap
- [ ] rollback strategy

DoD:
- interruption-safe (no partial state)
- apply is idempotent

## EPIC 5 — Doctor
- [ ] detect duplicates across known discovery paths
- [ ] detect broken symlinks and missing files
- [ ] suggest fixes; implement `--fix` safe subset

DoD:
- “doctor” output is actionable
- “doctor --fix” never deletes user data without confirmation

## EPIC 6 — Scanner (lint + security)
- [ ] spec linter
- [ ] risky-command heuristics
- [ ] SARIF output
- [ ] integrate into `apply`

DoD:
- scan catches known-bad fixtures
- supports warn/fail policy

## EPIC 7 — Docs + distribution
- [ ] README with quickstart and examples
- [ ] publish to npm (or release binaries)
- [ ] add homebrew formula (optional)
- [ ] landing page + docs site

## EPIC 8 — Cloud push/pull (v1+)
- [ ] Anthropic Skills API uploader
- [ ] OpenAI Skills API uploader
- [ ] auth + tokens handling
- [ ] team workspace sync

