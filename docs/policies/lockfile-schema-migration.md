# Lockfile Schema Migration Playbook

## Current lockfile contract
- File: `skillbase.lock.json`
- Schema version field: `version`
- Current version: `1`

## Compatibility policy
- Readers MUST reject unknown/malformed critical fields.
- Writers MUST preserve deterministic key ordering and formatting.
- Backward-incompatible lockfile changes require a version bump.

## Migration workflow
1. Introduce parser support for `N` and `N+1` versions.
2. Add migration transform from `N` -> `N+1`.
3. Add regression fixtures for both versions.
4. Release with explicit migration notes.
5. Remove `N` write support only after at least one stable release cycle.

## Safety requirements
- Never silently coerce invalid source metadata.
- Never auto-accept path fields outside managed store boundaries.
- Always run `pnpm verify` after migration updates.

## Rollback
- Keep previous parser branch logic until migration confidence is established.
- If migration defects are found, restore prior parser behavior and block new writes to `N+1` until fixed.
