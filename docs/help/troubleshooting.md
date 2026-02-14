# Troubleshooting

## Symptom: "I don't know what to do next"
Cause:
- Onboarding state is unclear (missing manifest, lockfile, scan, or apply step).

Fix:
1. Run `pnpm tsx src/cli.ts journey`.
2. Execute the `Next best action` shown.
3. Re-run `journey` until all core steps are complete.

## Symptom: "Unknown command" or command typo
Cause:
- Mistyped command name.

Fix:
1. Re-run the command and follow the built-in `Did you mean` suggestion.
2. Run `pnpm tsx src/cli.ts help` for the full command list.
3. Run `pnpm tsx src/cli.ts help <command>` for command-specific examples.

## Symptom: `invalid-manifest`
Cause:
- Unknown key or schema mismatch in `runwright.yml` (legacy `skillbase.yml` is still accepted).

Fix:
1. Compare manifest to `MANIFEST_SPEC.md`.
2. Remove unknown keys/typos.
3. Re-run `scan --format json`.

## Symptom: `lockfile-error` in frozen mode
Cause:
- Missing/malformed/outdated `skillbase.lock.json`.

Fix:
1. Run `update --json`.
2. Commit lockfile.
3. Re-run frozen command.

## Symptom: apply fails due to security findings
Cause:
- Blocking scanner findings in `fail` mode.

Fix:
1. Review finding IDs in scan output.
2. Remove risky instructions or apply scoped policy exception with reason/expiry.
3. Re-run `scan` then `apply`.

## Symptom: verify-bundle fails
Cause:
- Tampered archive, wrong signature key, or missing required signature.

Fix:
1. Re-export bundle from trusted source.
2. Verify with matching key algorithm and key.
3. Confirm checksum/signature values.

## Symptom: quality gate fails in CI
Cause:
- One or more checks in scorecard/evidence are non-success.

Fix:
1. Inspect scorecard JSON/MD artifacts.
2. Fix failing stage directly (verify/mutation/fuzz/perf/etc.).
3. Re-run `ship:gate` locally before pushing.
