# Skillbase

```text
  ____  _    _ _ _ _ _
 / ___|| | _(_) | | | |__   __ _ ___
 \___ \| |/ / | | | | '_ \ / _` / __|
  ___) |   <| | | | | |_) | (_| \__ \
 |____/|_|\_\_|_|_|_|_.__/ \__,_|___/
```

Policy-first manifest and supply-chain manager for **Agent Skills** across Codex, Claude Code, Cursor, and compatible tooling.

[![CI](https://github.com/jlov7/skillbase/actions/workflows/ci.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/ci.yml)
[![Release Verify](https://github.com/jlov7/skillbase/actions/workflows/release-verify.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/release-verify.yml)
[![CodeQL](https://github.com/jlov7/skillbase/actions/workflows/codeql.yml/badge.svg)](https://github.com/jlov7/skillbase/actions/workflows/codeql.yml)

## What This Does

Skillbase gives teams one deterministic way to:
- define which skills should exist
- scan for risky content before install
- apply skills across tools consistently
- export signed bundles for distribution
- verify artifact integrity and provenance

## Why It Matters

Without Skillbase, teams often have:
- ad hoc folder copying
- no policy checks before install
- unclear drift between machines
- weak release verification

With Skillbase, teams get:
- reproducible state from manifest + lockfile
- explicit security policy and audit evidence
- deterministic install/export/verify flows
- CI-ready machine-readable contracts

## How It Works

1. **Define** desired state in `skillbase.yml`.
2. **Resolve + lock** sources with `skillbase update`.
3. **Scan + apply** safely with `skillbase scan` and `skillbase apply`.
4. **Package + verify** with `skillbase export` and `skillbase verify-bundle`.

## Install Prerequisites

- Node.js 20+
- `pnpm`

```bash
pnpm install
```

## First Successful Run (2 Minutes)

```bash
# 1) Initialize a manifest in your project
pnpm tsx src/cli.ts init

# 2) Add at least one local skill
mkdir -p skills/safe
cat > skills/safe/SKILL.md <<'MD'
---
name: safe
description: safe skill
---

# Safe
MD

# 3) Build lockfile + scan + dry-run apply
pnpm tsx src/cli.ts update --json
pnpm tsx src/cli.ts scan --format json
pnpm tsx src/cli.ts apply --target codex --scope project --mode copy --dry-run --json
```

If these pass, you are fully onboarded.

## Choose Your Onboarding Path

- Technical quickstart: `docs/getting-started/quickstart.md`
- Non-technical onboarding: `docs/getting-started/non-technical-onboarding.md`
- End-to-end user journeys: `docs/getting-started/user-journeys.md`
- Common command recipes: `docs/help/cli-recipes.md`
- Troubleshooting guide: `docs/help/troubleshooting.md`

## Command Cheat Sheet

| Goal | Command |
| --- | --- |
| Initialize manifest | `skillbase init` |
| Validate sources/policy | `skillbase scan --format json` |
| Check policy exceptions | `skillbase policy check --json` |
| Build deterministic lockfile | `skillbase update --json` |
| Apply skills locally | `skillbase apply --target all --mode copy` |
| Export signed bundle | `skillbase export --out release.zip --sign-private-key key.pem --deterministic --json` |
| Verify bundle | `skillbase verify-bundle --bundle release.zip --sign-public-key pub.pem --require-signature --json` |

For detailed command help:

```bash
pnpm tsx src/cli.ts help
pnpm tsx src/cli.ts <command> --help
```

## Trust, Security, and Quality

Core local quality gates:
- `pnpm verify`
- `pnpm audit:deps`
- `pnpm ship:gate`

Advanced reliability gates:
- `pnpm ship:soak -- --iterations 2 --only verify --only audit --only sbom`
- `pnpm perf:snapshot -- --out reports/performance/current.snapshot.json`
- `pnpm perf:trend:check -- --current reports/performance/current.snapshot.json --baseline docs/benchmarks/performance-baseline.json --max-regression-percent 40 --out reports/performance/trend.report.json`

## Docs Map

- Product and architecture: `PRD.md`, `ARCHITECTURE.md`
- CLI and data contracts: `CLI_SPEC.md`, `MANIFEST_SPEC.md`
- Security and release policy: `SECURITY.md`, `docs/policies/release-signing-runbook.md`
- Quality evidence policy: `docs/policies/quality-evidence-policy.md`
- Versioning/deprecation policy: `docs/policies/versioning-and-deprecation.md`
- Operator docs: `docs/operations/operator-runbook.md`, `docs/operations/incident-playbook.md`

## Contributing

- Repository ownership and support process: `.github/CODEOWNERS`, `.github/SUPPORT.md`
- Security disclosure path: `SECURITY.md`
- Before opening PRs, run `pnpm verify`.
