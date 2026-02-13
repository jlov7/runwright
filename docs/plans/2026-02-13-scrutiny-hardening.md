# Scrutiny Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn this scaffold into a scrutiny-grade MVP with deterministic quality gates, enforceable manifest validation, working core CLI workflows, and security-aware scanning.

**Architecture:** Keep the current TypeScript CLI structure but replace stubs with small, composable modules. Implement scanner and adapter logic as pure filesystem functions, then wire commands through a deterministic CLI flow with explicit exit codes.

**Tech Stack:** TypeScript, zod, vitest, eslint v9 flat config, tsup, pnpm.

---

### Task 1: Establish hard quality gates

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write failing test**
- Not applicable (tooling baseline change).

**Step 2: Reproduce failure**
- Run: `pnpm lint`
- Expected: ESLint v9 fails due to missing `eslint.config.*`.

**Step 3: Implement minimal fix**
- Add ESLint flat config.
- Add `typecheck` and `verify` scripts.
- Make CI run `pnpm verify` on OS matrix.

**Step 4: Verify**
- Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

### Task 2: Strengthen manifest validation with friendly errors

**Files:**
- Modify: `src/manifest.ts`
- Modify: `tests/manifest.test.ts`

**Step 1: Write failing tests**
- Add tests for: invalid `version`, invalid source format, unknown skillset in `apply.useSkillsets`.

**Step 2: Run tests to verify RED**
- Run: `pnpm test tests/manifest.test.ts`
- Expected: new tests fail.

**Step 3: Minimal implementation**
- Enforce `version: 1` literal.
- Validate source schemes (`owner/repo`, `https://skills.sh/...`, `local:`).
- Add cross-field validation for referenced skillsets.

**Step 4: Verify GREEN**
- Run: `pnpm test tests/manifest.test.ts`.

### Task 3: Implement lint + security scanners (core scrutiny controls)

**Files:**
- Modify: `src/scanner/lint.ts`
- Modify: `src/scanner/security.ts`
- Create: `tests/scanner.test.ts`

**Step 1: Write failing tests**
- Add tests for valid skill dir, missing SKILL.md, malformed frontmatter, and high-risk command detection.

**Step 2: Run tests to verify RED**
- Run: `pnpm test tests/scanner.test.ts`
- Expected: failing scanner tests.

**Step 3: Minimal implementation**
- Lint scanner: frontmatter, required `name`/`description`, size limits.
- Security scanner: heuristic high-risk patterns (`curl|bash`, `wget|sh`, `sudo`, unpinned `npx`, secret exfil patterns).

**Step 4: Verify GREEN**
- Run: `pnpm test tests/scanner.test.ts`.

### Task 4: Replace CLI stubs with working MVP commands

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/adapters/codex.ts`
- Modify: `src/adapters/claude.ts`
- Modify: `src/adapters/cursor.ts`
- Create: `tests/cli.integration.test.ts`

**Step 1: Write failing tests**
- `init` creates `skillbase.yml`.
- `scan` returns security failure code when policy is `fail`.
- `apply --dry-run` returns plan-like summary.
- `doctor` reports broken symlink.

**Step 2: Run tests to verify RED**
- Run: `pnpm test tests/cli.integration.test.ts`
- Expected: failures due to stubs.

**Step 3: Minimal implementation**
- Implement `init`, `apply`, `scan`, `doctor`, `list`.
- Add target/scope resolution from adapters.
- Implement local-source-only resolution for MVP installs.
- Implement `copy` + `link` apply modes (mirror aliases copy).
- Exit code semantics: 0/2/10/20/30.

**Step 4: Verify GREEN**
- Run: `pnpm test tests/cli.integration.test.ts`.

### Task 5: Full verification gate

**Files:**
- Modify: `README.md` (quick verification and current capability statement)

**Step 1: Run full verification**
- Run: `pnpm verify`

**Step 2: Confirm outputs**
- Lint clean, typecheck clean, all tests green, build succeeds.

