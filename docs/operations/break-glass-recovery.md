# Break-Glass Recovery

## When to use break-glass
- Only for `P0`/`P1` incidents where standard release controls cannot restore service quickly.
- Requires explicit incident owner and timestamped justification.

## Temporary emergency procedure
1. Freeze normal release publication.
2. Build candidate artifact in isolated environment.
3. Run minimum mandatory checks:
- `pnpm verify`
- `pnpm release:verify-local`
- `pnpm release:artifact-manifest:generate`
- `pnpm release:artifact-manifest:verify`
4. Publish emergency artifact with explicit `BREAK_GLASS` marker in release notes.

## Mandatory follow-up within 24 hours
1. Re-run full normal release workflow with signed tag and attestations.
2. Replace emergency artifact with fully attested release artifact.
3. Publish post-incident corrective actions.

## Hard constraints
- Never bypass checksum/signature verification.
- Never bypass immutable artifact manifest verification.
- Never treat break-glass output as final GA artifact.
