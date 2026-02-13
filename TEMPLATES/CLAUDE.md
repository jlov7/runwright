# CLAUDE.md (template)

You are working in the Skillbase repository.

## Priorities

1. Correctness and safety (no destructive operations without confirmation)
2. Cross-platform behavior (Windows/macOS/Linux)
3. Deterministic output (lockfiles, plans)
4. Tests for every behavior change

## Guardrails

- Never execute scripts from skills.
- When copying, preserve file permissions where possible.
- Prevent path traversal and symlink attacks.

## When unsure

- Prefer implementing “warn + explain” behavior over silent failure.
- Add a `doctor` check and guide the user.

