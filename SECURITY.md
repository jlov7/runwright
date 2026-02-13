# Security - Skillbase

## Security posture summary
Skillbase is a policy-first manifest manager for untrusted skill content.
It is designed to fail closed on malformed inputs, path traversal attempts, lockfile drift, and bundle tampering.

## Trust boundaries
1. Manifest and lockfile content are untrusted input until schema + semantic validation succeeds.
2. Skill source content (local, GitHub, skills.sh) is untrusted and scanned before policy decisions.
3. Exported bundles are untrusted until checksum and signature verification succeed.

## Threat model
### 1) Malicious or sloppy skills
- Remote shell execution instructions (`curl|bash`, `wget|sh`).
- Privilege escalation instructions (`sudo`, overly permissive chmod).
- Exfiltration instructions (`cat ~/.ssh`, `printenv`).

### 2) Supply chain and provenance
- Dependency compromise and transitive package drift.
- Tampered release artifacts or forged signatures.
- Ambiguous source references that bypass intended policy.

### 3) Filesystem attacks
- Path traversal via skill/source picks.
- Symlink escape attempts in source resolution and digest walks.
- Lockfile path escape attempts outside managed store roots.

## Implemented controls
### Validation and fail-closed behavior
- Strict manifest schema with semantic checks (version, source formats, skillset references, unique arrays).
- Strict lockfile schema with source-key/type invariants and digest/path validation.
- Stable machine-readable error codes for automation (`invalid-manifest`, `invalid-lockfile`, `bundle-verification-failed`, etc.).

### Scanner and policy controls
- Stable rule IDs in scanner output and SARIF.
- Policy controls in manifest:
  - `defaults.scan.allowRuleIds`
  - `defaults.scan.severityOverrides`
  - `defaults.scan.allowlist` with required reason and optional scope/expiry.
- `policy check` command for unresolved/expired policy exceptions.
- Policy decision traces in scan JSON output and optional JSONL export.

### Reproducibility and integrity controls
- Deterministic lockfile materialization and order-insensitive frozen comparisons.
- Deterministic bundle export mode (`--deterministic`, `SOURCE_DATE_EPOCH`).
- Bundle manifest checksums and strict archive guardrails (path safety, method restrictions, duplicate/unsafe entry rejection).
- HMAC and ed25519 signature verification modes with strict key validation.
- Signature key identity binding through manifest `signature.keyId` fingerprint checks.

### Release and CI controls
- Pinned GitHub Actions references.
- Multi-platform verify gate + dependency audit.
- Mutation testing and differential fuzzing gates.
- SARIF upload and CodeQL workflow.
- Signed release verification workflow with GitHub attestations and downstream consumer verification.
- CycloneDX SBOM generation in CI.
- Quality scorecard artifacts for CI and release verification runs.

## Security operating guidance
### Recommended CI posture
- Run `pnpm verify`, `pnpm audit:deps`, `pnpm test:mutation`, `pnpm test:fuzz-differential`, and `pnpm sbom:generate` on protected branches.
- Treat mutation, fuzz mismatch, and bundle verification failures as release blockers.

### Incident response
1. Isolate and stop releases if signature/provenance verification fails.
2. Rotate release keys and re-run release verification workflow.
3. Regenerate and publish new signed artifacts and attestations.
4. Preserve previous public keys and scorecards for audit history.

## Reporting
Report suspected vulnerabilities privately through repository security reporting channels.
Include reproduction steps, affected command(s), and expected vs actual fail-closed behavior.

## Vulnerability disclosure SLA
- Initial acknowledgment of private reports: within 24 hours.
- Severity assessment and reproduction decision: within 3 business days.
- Mitigation plan publication target:
- critical/high: within 7 business days
- medium/low: within 21 business days
- Coordinated disclosure and advisory publication occur after a validated fix is available.
