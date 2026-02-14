# Skillbase

```text
 ____  _    _ _ _ _ ____                    
/ ___|| | _(_) | | | __ )  __ _ ___  ___   
\___ \| |/ / | | | |  _ \ / _` / __|/ _ \  
 ___) |   <| | | | | |_) | (_| \__ \  __/  
|____/|_|\_\_|_|_|_|____/ \__,_|___/\___|  
```

Policy-first skill distribution for Codex, Claude Code, Cursor, and compatible tools.

[![CI](https://github.com/jlov7/skillbase/actions/workflows/ci.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/ci.yml)
[![Release Verify](https://github.com/jlov7/skillbase/actions/workflows/release-verify.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/release-verify.yml)
[![CodeQL](https://github.com/jlov7/skillbase/actions/workflows/codeql.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/codeql.yml)

## What It Does

Skillbase gives teams one reproducible path to:
- define approved skills once
- scan for risky instructions before install
- apply consistently across tools and machines
- export and verify release bundles with integrity checks

## Why Teams Use It

- Prevents ad hoc manual copy/paste setup.
- Makes onboarding deterministic instead of "works on my machine".
- Produces evidence for security/compliance review.
- Reduces release risk with verifiable artifacts.

## 2-Minute First Success

```bash
pnpm install
pnpm tsx src/cli.ts init
pnpm tsx src/cli.ts journey
```

Then follow the `Next best action` shown by `journey` until core steps are complete.

## How People Actually Use Skillbase

### Technical (individual engineer)
1. `init`
2. Add one `skills/<name>/SKILL.md`
3. `update` -> `scan` -> `apply --dry-run` -> `apply`

### Technical (team/platform)
1. Standardize `skillbase.yml` and `skillbase.lock.json`
2. Enforce `update --frozen-lockfile`, `scan`, and `ship:gate` in CI
3. Publish verifiable bundles with `export` + `verify-bundle`

### Non-technical (manager/reviewer)
1. Review `journey` completion and onboarding docs
2. Check scan/policy evidence and quality gate output
3. Confirm release verification artifacts exist and pass

## Core Commands

| Goal | Command |
| --- | --- |
| See onboarding progress | `skillbase journey` |
| Create starter manifest | `skillbase init` |
| Resolve and lock sources | `skillbase update --json` |
| Run lint/security checks | `skillbase scan --format json` |
| Validate install plan | `skillbase apply --dry-run --json` |
| Install to targets | `skillbase apply --target all --scope project --mode copy --json` |
| Package release bundle | `skillbase export --out skillbase-release.zip --deterministic --json` |
| Verify release bundle | `skillbase verify-bundle --bundle skillbase-release.zip --json` |

## Start Here By Role

- Technical quickstart: `docs/getting-started/quickstart.md`
- Non-technical onboarding: `docs/getting-started/non-technical-onboarding.md`
- Persona journeys: `docs/getting-started/user-journeys.md`
- Practical command recipes: `docs/help/cli-recipes.md`
- Troubleshooting: `docs/help/troubleshooting.md`

## Quality and Trust Gates

Run locally before merging or releasing:

```bash
pnpm verify
pnpm ship:gate
```

For deeper release confidence:

```bash
pnpm ship:soak -- --iterations 2 --only verify --only audit --only sbom
pnpm perf:snapshot -- --out reports/performance/current.snapshot.json
pnpm perf:trend:check -- --current reports/performance/current.snapshot.json --baseline docs/benchmarks/performance-baseline.json --max-regression-percent 40 --out reports/performance/trend.report.json
```

## Reference Docs

- Product + architecture: `PRD.md`, `ARCHITECTURE.md`
- CLI + manifest contracts: `CLI_SPEC.md`, `MANIFEST_SPEC.md`
- Security policy: `SECURITY.md`
- Release signing/integrity: `docs/policies/release-signing-runbook.md`
