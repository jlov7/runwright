# Quickstart (Technical)

## Goal
Go from zero to a verified first apply in under 10 minutes.

## 1) Prerequisites
- Node.js 20+
- `pnpm`

```bash
pnpm install
```

## 2) Initialize project manifest

```bash
pnpm tsx src/cli.ts init
```

Expected result:
- `skillbase.yml` exists
- `.gitignore` includes skillbase ignores

## 3) Check your onboarding state

```bash
pnpm tsx src/cli.ts journey
```

Expected result:
- clear checklist of core onboarding steps
- one `Next best action` command

## 4) Add your first skill

```bash
mkdir -p skills/safe
cat > skills/safe/SKILL.md <<'MD'
---
name: safe
description: safe skill
---

# Safe
MD
```

## 5) Resolve and lock sources

```bash
pnpm tsx src/cli.ts update --json
```

Expected result:
- `status: 0`
- `skillbase.lock.json` generated

## 6) Scan policy/security

```bash
pnpm tsx src/cli.ts scan --format json
```

Expected result:
- no blocking findings for safe skill

## 7) Dry-run apply

```bash
pnpm tsx src/cli.ts apply --target all --scope project --mode copy --dry-run --json
```

Expected result:
- `status: 0`
- operation plan printed in JSON

## 8) Real apply

```bash
pnpm tsx src/cli.ts apply --target all --scope project --mode copy --json
```

## 9) Confirm journey progress

```bash
pnpm tsx src/cli.ts journey
```

Expected result:
- all core steps complete
- next action points to optional hardening/release flow

## 10) Optional: package and verify

```bash
pnpm tsx src/cli.ts export --out skillbase-release.zip --deterministic --json
pnpm tsx src/cli.ts verify-bundle --bundle skillbase-release.zip --json
```

## Success criteria
You are fully onboarded when:
- `update`, `scan`, and `apply` return success
- lockfile exists and remains stable across reruns
- apply is idempotent (running again does not change desired state)
- `journey` shows all core steps complete

## Next
- Journeys by persona: `docs/getting-started/user-journeys.md`
- Troubleshooting: `docs/help/troubleshooting.md`
