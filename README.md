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

## What you get in this bundle

- `PRD.md` — product requirements document (MVP → v1).
- `ARCHITECTURE.md` — technical design and module boundaries.
- `MANIFEST_SPEC.md` — manifest + lockfile spec.
- `CLI_SPEC.md` — CLI commands, flags, exit codes.
- `SECURITY.md` — threat model + mitigations (supply chain, scripts).
- `TEST_PLAN.md` — unit/integration/e2e strategy + CI matrix.
- `TASK_LIST.md` — epics + granular tasks with definitions of done.
- `PROMPTS.md` — copy/paste prompts for Codex, Claude Code, and Cursor.
- `TEMPLATES/` — starter instruction files for AGENTS.md / CLAUDE.md / Cursor Rules.

## Current MVP capabilities

- `skillbase init` scaffolds a starter `skillbase.yml` and updates `.gitignore`.
- `skillbase scan` runs lint + security heuristics against local manifest sources.
- `skillbase scan --format json` emits policy decisions (reported vs suppressed), including override/suppression rationale.
- `skillbase scan --policy-decisions-out <path>` writes policy decisions as JSONL for CI artifact retention/history.
- `skillbase apply` resolves local sources and installs skills to Codex/Claude/Cursor in `link`/`copy`/`mirror` mode.
- `skillbase apply --fix` applies safe doctor repairs (currently broken symlink cleanup) before install planning.
- `skillbase apply --frozen-lockfile` enforces deterministic resolution against `skillbase.lock.json`.
- `skillbase doctor` detects broken symlinks, invalid skill directories, and duplicate skill names.
- `skillbase list` prints resolved local skills and target install paths.
- `skillbase update` resolves sources, materializes canonical skills into `.skillbase/store`, and writes deterministic lockfile data.
- `skillbase policy check` validates manifest scan allowlist entries (expired exceptions, unknown/unresolved source scopes, unknown skills).
- `skillbase export` creates a zip bundle containing manifest, lockfile, and resolved skills.
- `skillbase export --sign-key <path>` adds a signed bundle manifest (`HMAC-SHA256`).
- `skillbase export --sign-private-key <path>` adds stronger asymmetric signatures (`ed25519`).
- `skillbase export --deterministic` produces reproducible archives (stable timestamps/metadata; `SOURCE_DATE_EPOCH` aware).
- `skillbase verify-bundle --bundle <zip> --sign-key <path>` verifies checksums and signature integrity.
- `skillbase verify-bundle --bundle <zip> --sign-public-key <path>` verifies `ed25519` signatures.
- `verify-bundle` can run from detached directories and does not require a local project manifest.
- Remote source controls: `--refresh-sources` bypasses remote resolution cache and `--remote-cache-ttl <seconds>` sets cache TTL (`0` disables cache reuse).
- Source resolution supports `local:<path>`, `owner/repo` (GitHub), and `https://skills.sh/<owner>/<repo>[/skill]`.
- Stable exit codes for key automation flows (`0`, `2`, `10`, `11`, `20`, `30`).

## Quick start

1. Install dependencies: `pnpm install`
2. Initialize a manifest: `pnpm tsx src/cli.ts init`
3. Add local skills under `./skills/<skill-name>/SKILL.md`
4. Validate: `pnpm tsx src/cli.ts scan --security warn`
5. Dry run install: `pnpm tsx src/cli.ts apply --dry-run --json`
6. Apply for real: `pnpm tsx src/cli.ts apply --target all --mode copy`

## Release signing setup (ed25519)

```bash
openssl genpkey -algorithm ed25519 -out bundle-private.pem
openssl pkey -in bundle-private.pem -pubout -out bundle-public.pem
SOURCE_DATE_EPOCH=1704067200 pnpm tsx src/cli.ts export --out skillbase-release.zip --sign-private-key bundle-private.pem --deterministic --json
pnpm tsx src/cli.ts verify-bundle --bundle skillbase-release.zip --sign-public-key bundle-public.pem --require-signature --json
```

- `_bundle/manifest.json` records `signature.keyId` as `sha256:<hex>` fingerprint of the signing public key.
- CI release verification expects GitHub Actions secrets `SKILLBASE_RELEASE_PRIVATE_KEY` and `SKILLBASE_RELEASE_PUBLIC_KEY`.

## Philosophy

- **Idempotent apply**: Running `skillbase apply` twice yields the same filesystem state.
- **Safe defaults**: treat skills as untrusted input (especially scripts).
- **Deterministic installs**: manifest + lockfile → reproducible skillsets.
- **Adapters, not forks**: integrate with existing ecosystems (e.g., `npx skills`) when it reduces surface area.

## Quality gate

- `pnpm verify` is the canonical local gate.
- It enforces `lint + typecheck + tests + build`.
- Core CLI JSON outputs are validated against versioned JSON Schema files in `docs/schemas/cli/`.
- `pnpm test:contracts` runs adapter and source-provider contract harnesses.
- `pnpm test:perf` runs resolver-cache and larger-bundle performance guard suites.
- `pnpm test:mutation` runs Stryker mutation testing for core policy/scanner/lockfile modules with static-mutant filtering and focused branch/boolean mutators (`break >= 85`, `high >= 90`).
- `pnpm test:fuzz-differential` runs deterministic manifest parser-vs-CLI differential fuzzing and writes artifacts to `.fuzz-artifacts/`.
- `pnpm sbom:generate` emits CycloneDX SBOM evidence to `reports/sbom/bom.json`.
- `pnpm scorecard:generate -- --check verify=success ...` emits machine/human quality scorecards.
- `pnpm quality:evidence:verify -- --scorecard ... --require-check ...` enforces scorecard/evidence gates with machine-readable output.
- `pnpm ship:gate` runs the full release-readiness gate and emits consolidated artifacts (`ship-gate.summary.json`, scorecard, evidence verdict, versioned stage logs).
- `pnpm ship:soak -- --iterations <N>` runs repeated ship-gate checks and fails on non-deterministic artifact drift.
- `pnpm release:verify-local` runs end-to-end signed release artifact verification locally.
- `pnpm perf:snapshot` captures reproducible performance snapshots.
- `pnpm perf:trend:check -- --current ... --baseline ...` enforces regression deltas and writes trend reports.
- `pnpm release:tag:verify` verifies signed annotated tag integrity for tag-based releases.
- `pnpm release:artifact-manifest:generate` and `pnpm release:artifact-manifest:verify` enforce immutable release artifact hashing.
- `pnpm release:notes:generate` builds machine-supported release notes from scorecard/evidence artifacts.
- `pnpm audit:deps` enforces production dependency audit at `high` severity.
- CI runs `audit:deps` and `verify` on Ubuntu, macOS, and Windows.
- CI also generates scanner SARIF output and publishes it as an artifact for downstream security workflows.
- CI includes a release verification workflow that builds, signs, and verifies release bundles.
- CI release verification also emits GitHub artifact attestations for `skillbase-release.zip`.
- CI verifies release artifacts using consumer-grade checks (`scripts/verify_release_consumer_artifact.sh`) before publishing artifacts.
- CI includes a separate CodeQL workflow for static security analysis on pushes, pull requests, and weekly schedule.
- CI generates and uploads a CycloneDX SBOM artifact (`sbom` job).
- CI generates and uploads a consolidated quality scorecard artifact summarizing gate outcomes (`quality-scorecard` job).
- CI enforces quality-evidence verification (`verify_quality_evidence.ts`) and publishes gate verdict artifacts.
- CI runs compatibility matrix fixtures for manifest/lockfile backward-compat guarantees (`compatibility-matrix` job).
- CI runs performance snapshot/trend regression checks and publishes trend artifacts (`performance-trend` job).
- Dependabot is configured for weekly npm and GitHub Actions update PRs.
- Workflow policy tests enforce least-privilege permissions and explicit CI job timeouts.
- CI and CodeQL workflows use concurrency cancellation to prevent stale runs from consuming gate capacity.
- GitHub Actions are commit-pinned (immutable `uses:` refs) and enforced by workflow policy tests.
- Reliability soak checks run in a dedicated workflow with repeated ship-gate consistency verification (`reliability-soak.yml`).
- Repository governance is explicit via `LICENSE` (Apache-2.0), `.github/CODEOWNERS`, and `.github/SUPPORT.md`.
- Version compatibility and deprecation guarantees are defined in `docs/policies/versioning-and-deprecation.md`.

## Reproducibility Guarantees

- `update` pins each source and skill digest in `skillbase.lock.json`.
- `update --frozen-lockfile` performs semantic lockfile comparison (order-insensitive) and fails only on real content drift.
- `apply --frozen-lockfile` verifies lockfile skill paths and digests before applying.
- Frozen lockfile mode fails closed with exit `11` for missing, malformed, or mismatched lockfiles.
- Frozen apply enforces that lockfile skill paths resolve under `.skillbase/store/skills` (prevents path-escape injection).
- Frozen apply uses lockfile-resolved store paths, so installs can still succeed if original source folders were removed after `update`.
- Lockfile parsing is strict (schema-validated digests, timestamps, absolute paths, and object shapes) to prevent ambiguous malformed lockfiles from entering apply/update flows.
- Lockfile parsing enforces semantic source invariants (`local` sources require `resolved.ref=local`; remote sources require `commit|tag` refs).
- Lockfile parsing enforces source-key/type consistency (`local:* -> local`, `owner/repo -> github`, `https://skills.sh/... -> skills.sh`) and rejects unsupported source key formats.
- `export` also fails closed with exit `11` when an existing `skillbase.lock.json` is malformed.
- `export` verifies lockfile materialization boundaries/digests before packaging.
- Any command invoked with `--json` emits structured JSON error payloads (`status`, `error`) on failure paths.
- JSON error payloads include stable machine `code` values (e.g., `missing-manifest`, `invalid-target`, `invalid-lockfile`, `unknown-command`).
- Manifest parsing is strict: unknown/typo keys are rejected with `invalid-manifest` to prevent silent misconfiguration.
- Manifest target keys are strict (`codex`, `claude-code`, `cursor` only) and `apply.useSkillsets` must be unique.
- CLI input validation fails closed with stable machine codes (`invalid-flag`, `invalid-argument`) for unsupported flags/positionals.
- Duplicate CLI flags are rejected as `invalid-argument` to keep automation semantics unambiguous.
- CLI flag parsing is strict: value-required flags fail when value is missing, and boolean flags fail when a value is provided.
- Source resolution failures emit stable machine code `source-resolution-failed` with deterministic messages for automation.
- Source pick resolution rejects symlink-based path escapes and fails closed as `source-resolution-failed`.
- Source pick resolution rejects ambiguous basename picks (when one name matches multiple skills) and fails closed as `source-resolution-failed`.
- `scan` validates `--format` and `--remote-cache-ttl` strictly and fails closed with stable machine codes (`invalid-format`, `invalid-remote-cache-ttl`).
- Security findings now carry stable rule IDs and SARIF uses those IDs directly (message text changes do not break policy automation).
- Manifest policy supports `defaults.scan.allowRuleIds` to explicitly suppress accepted scanner rules by ID.
- Manifest policy also supports `defaults.scan.severityOverrides` and scoped `defaults.scan.allowlist` entries (`ruleId`, optional `source`/`skill`, optional `expiresAt`, required `reason`).
- Scan JSON includes `summary.suppressedFindings` and `policyDecisions` for auditable policy outcomes.
- JSON command payloads are versioned (`schemaVersion: "1.0"`) for contract-safe automation (`init`, `doctor`, `list`, `apply`, `update`, `export`, `verify-bundle`).
- Mutating command execution emits structured JSONL operation events at `.skillbase/operations.jsonl` (override path with `SKILLBASE_OPERATION_LOG_PATH`; set it to `off` to disable).
- Signing key handling is strict: missing/unreadable/empty key files fail with stable machine code `invalid-sign-key`.
- Bundle signatures support both HMAC (`--sign-key`) and ed25519 (`--sign-private-key` / `--sign-public-key`) verification modes.
- `apply`, `update`, and `export` fail closed with `duplicate-skill-name` when multiple sources resolve to the same install name.
- Duplicate-skill detection is case-insensitive to avoid cross-platform filesystem collisions (`Safe` and `safe` are treated as conflicting names).
- `apply --frozen-lockfile --json` returns stable `reason` codes: `missing-lockfile`, `invalid-lockfile`, `lockfile-mismatch`.
- Frozen lockfile and verification failures expose stable JSON machine codes, including `lockfile-error` and `bundle-verification-failed`.
- Bundle exports include `_bundle/manifest.json` with per-file checksums; verification enforces exact archive contents (no unexpected files).
- Deterministic bundle mode (`export --deterministic`) produces reproducible archives and honors `SOURCE_DATE_EPOCH`.
- Bundle exports include provenance metadata (`provenance.generator`, `provenance.contractVersion`, `provenance.createdBy`) in `_bundle/manifest.json`.
- Bundle verification validates manifest structure and file-path safety (rejects traversal/absolute paths and malformed entries).
- Bundle verification enforces strict bundle-manifest keys and required content entries (`skillbase.lock.json`, project manifest, and `skills/*/SKILL.md`).
- Bundle verification enforces per-skill integrity for `skills/*` entries (each skill directory represented in manifest must include its own `SKILL.md`).
- Bundle verification performs pre-inflate ZIP guardrails and fails closed with `invalid-bundle-archive`/`bundle-too-large` before extraction on malformed or abusive archives.
- Pre-inflate ZIP guardrails also reject unsafe/duplicate archive entry paths, encrypted entries, and unsupported compression methods.
- `verify-bundle` also fails closed with `invalid-bundle-archive` when the bundle path is unreadable.
- Signed bundles require the corresponding verification key for the selected signature algorithm.
- Downstream/offline consumers can verify release zip + checksums + signature + attestation bundle via `scripts/verify_release_consumer_artifact.sh`.
- Release verification workflow publishes `release-scorecard.json` / `release-scorecard.md` alongside signed artifact evidence.

See also: `docs/policies/json-contract-versioning.md`
See also: `docs/policies/lockfile-schema-migration.md`
See also: `docs/policies/release-signing-runbook.md`
See also: `docs/policies/quality-evidence-policy.md`
See also: `docs/policies/versioning-and-deprecation.md`
See also: `docs/operations/operator-runbook.md`
See also: `docs/operations/incident-playbook.md`
See also: `docs/operations/failure-mode-catalog.md`
See also: `docs/operations/break-glass-recovery.md`
See also: `docs/operations/external-scrutiny-program.md`
See also: `docs/schemas/quality/scorecard.schema.json`
See also: `docs/schemas/quality/evidence-verification.schema.json`
See also: `docs/schemas/quality/ship-gate-summary.schema.json`
See also: `docs/schemas/quality/ship-gate-stage-logs.schema.json`
See also: `docs/schemas/quality/ship-gate-soak-report.schema.json`
See also: `docs/schemas/quality/performance-snapshot.schema.json`
See also: `docs/schemas/quality/performance-trend-report.schema.json`
See also: `docs/schemas/quality/release-tag-signature-report.schema.json`
See also: `docs/schemas/quality/release-artifact-manifest.schema.json`
See also: `docs/schemas/quality/release-artifact-manifest-verify.schema.json`
See also: `docs/schemas/operation-event.schema.json`
See also: `docs/development/extension-authoring.md`
