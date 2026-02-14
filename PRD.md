# PRD — Runwright

## 1) Problem statement

AI coding tools increasingly support *Agent Skills* (folders containing a `SKILL.md` plus optional scripts/resources).  
In practice, users who switch between Codex, Claude Code, Cursor, etc. end up:

- copying skills into multiple tool-specific directories,
- dealing with different discovery paths and precedence rules,
- fighting symlink quirks and duplicates that waste context,
- lacking a reproducible, team-shareable way to pin “known good” skill sets,
- and facing an emerging **supply-chain** surface (skills often contain executable instructions and scripts).

## 2) Target users

1. **Power users**: 2–10 skills installed locally, jumping between tools daily.
2. **Teams**: need org-approved skill sets, pinned versions, and policies.
3. **Security-conscious orgs**: want allowlists, scanning, and audit logs.

## 3) Goals (MVP)

### G1 — Single manifest → many tools
- A declarative manifest defines what skills to install and where.
- One command installs/syncs across Codex, Claude Code, and Cursor.

### G2 — Deterministic state
- Lockfile records exact source and version/commit for each skill.
- `apply` is idempotent and safe.

### G3 — Real-world robustness
- Handles:
  - tools that don’t follow symlinks reliably,
  - duplicates across overlapping discovery paths,
  - Windows/macOS/Linux path differences,
  - atomic writes and rollbacks.

### G4 — Security baseline
- Validate SKILL.md format and frontmatter.
- Detect high-risk patterns in instructions/scripts (e.g., “curl | bash”, unpinned `npx`, etc.).
- Provide an allowlist mechanism and “safe mode”.

## 4) Non-goals (MVP)

- Running skills or executing scripts on behalf of the agent.
- Building a marketplace (use existing ones; integrate later).
- Enterprise SSO / admin UI (v1+).

## 5) Product requirements

### 5.1 Core features

**F1 — Manifest & lockfile**
- Read `skillbase.yml` (or `skillbase.json`) at repo root.
- Write `skillbase.lock.json` on successful resolution.

**F2 — Local store**
- Canonical copy of each installed skill lives in one place (user cache).
- Adapters materialize skills into each tool’s expected directories.

**F3 — Adapters (initial)**
- Codex adapter
- Claude Code adapter
- Cursor adapter

**F4 — Modes**
- `link`: symlink where safe (fast updates)
- `copy`: copy where symlinks are unreliable or unsupported
- `mirror`: canonical store + per-tool copy sync

**F5 — Doctor**
- Detect duplicates, broken installs, invalid skills, symlink loops.
- Optional `--fix` to repair.

**F6 — Security scan**
- Lint against Agent Skills spec.
- Heuristics for risky commands + scripts.
- Optional online verification for `npx` packages and remote fetches.

### 5.2 UX requirements

- Clear errors and actionable remediation steps.
- `--json` output for automation.
- `--dry-run` with a preview of filesystem changes.

## 6) Success metrics

- Time-to-setup: “fresh machine” → usable set of skills in < 5 minutes.
- Reliability: apply success rate > 99% in CI integration tests.
- Ecosystem adoption: stars, installs, PRs; listing in skills directories.

## 7) v1+ roadmap ideas

- Team sync: remote registry of manifests + lockfiles.
- Cloud push/pull:
  - upload skills to Anthropic workspace (Skills API),
  - upload skills to OpenAI Skills API (hosted skills).
- Sigstore signing and verification.
- Advanced policy engine: per-skill allowed-tools, per-agent allowlists.

