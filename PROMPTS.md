# Prompts — how to build Runwright with Codex / Claude Code / Cursor

Use these prompts as copy/paste tasks. Keep each PR small (1–3 hours of work).

---

## Operating rules (use in every tool)

- Follow repo docs: README + ARCHITECTURE + SECURITY.
- Make a concrete plan before editing.
- Keep changes minimal and reversible.
- Add tests for every behavior change.
- After code changes: run unit tests and format/lint.

---

## Prompt 0 — Repository bootstrap (Codex or Claude Code)

**Goal:** generate the initial project scaffold.

Prompt:

> You are working in a new repository named Runwright (working name).  
> Create a TypeScript CLI project with:
> - src/cli.ts (entry)
> - src/manifest.ts (parse+validate)
> - src/lockfile.ts
> - src/planner.ts
> - src/adapters/{codex,claude,cursor}.ts (stubs)
> - src/scanner/{lint,security}.ts (stubs)
> - tests/ with vitest
> - GitHub Actions CI with OS matrix (ubuntu/macos/windows)
> Make `pnpm test` run unit tests.  
> Keep everything minimal but production-quality.  
> Update README with local dev steps.

---

## Prompt 1 — Implement manifest parsing (Codex)

> Implement manifest parsing for `skillbase.yml` and `skillbase.json` based on MANIFEST_SPEC.md.  
> Requirements:
> - strict schema validation with helpful errors (path to field)
> - defaults merging
> - supports `targets`, `skillsets`, `apply`
> - unit tests for valid/invalid cases  
> Output: code + tests, and update docs if you changed the spec.

---

## Prompt 2 — Implement lockfile (Codex)

> Implement lockfile read/write:
> - deterministic ordering
> - stable JSON formatting
> - record generatedAt in ISO
> - unit tests for determinism across runs  
> Add `--frozen-lockfile` behavior to CLI (fails if mismatch).

---

## Prompt 3 — Cursor adapter (Cursor Agent mode)

> Implement the Cursor adapter with copy-mode default.  
> It should:
> - place skills into `.cursor/skills/<skill>/SKILL.md` for project scope  
> - place skills into `~/.cursor/skills/<skill>/SKILL.md` for global scope  
> - avoid symlinks by default; offer link mode behind a flag  
> - include an integration test that simulates the directory structure.  
> Also implement `doctor` checks for:
> - duplicates across project + global
> - broken symlinks
> - missing SKILL.md

---

## Prompt 4 — Claude Code adapter (Claude Code)

> Implement the Claude Code adapter for `.claude/skills` and `~/.claude/skills`.  
> Ensure it supports both skill directories and legacy `.claude/commands` (do not break).  
> Add tests and update docs.

---

## Prompt 5 — Security scanner (Claude Code)

> Implement a security scanner that inspects SKILL.md and bundled scripts.  
> Requirements:
> - must not execute anything
> - detect high-risk patterns: curl|bash, wget|sh, sudo, unpinned npx, chmod 777
> - output findings with severity and file/line references
> - support output formats: text, json, sarif  
> Add a fixture suite with known risky examples and unit tests.

---

## Prompt 6 — Planner + atomic apply (Codex)

> Implement an idempotent planner and atomic apply engine:
> - build plan of filesystem operations (mkdir/copy/symlink/delete/replace)
> - apply into a staging dir then rename swap
> - rollback on error
> - integration tests on all OS where possible  
> Ensure `apply` is safe and leaves no partial installs.

---

## Prompt 7 — Multi-agent review pass (Cursor subagents)

> Use subagents:
> - "QA" subagent: review for edge cases and missing tests
> - "Security" subagent: audit for path traversal and unsafe deletes
> - "Docs" subagent: ensure docs match reality  
> Produce a consolidated PR review with actionable change requests.

---

## Prompt 8 — Release prep (Codex)

> Prepare the repo for first public release:
> - semantic versioning
> - changelog
> - npm publish config (or binary release)
> - docs site content
> - usage examples  
> Also create a “demo gif script” describing how to record a 30s demo.

