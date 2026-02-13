# Versioning and Deprecation Policy

## Release versioning
- Skillbase follows Semantic Versioning (`MAJOR.MINOR.PATCH`).
- `MAJOR` increments for backward-incompatible CLI, manifest, lockfile, or JSON contract changes.
- `MINOR` increments for backward-compatible features.
- `PATCH` increments for backward-compatible fixes and security hardening.

## Contract stability guarantees
- Manifest `version` and lockfile `version` are explicit compatibility boundaries.
- JSON command outputs remain stable within a major version and are guarded by schema/contract tests.
- New fields in JSON outputs must be additive and schema-versioned.

## Deprecation process
- Any planned breaking change requires:
1. Published deprecation notice in release notes and policy docs.
2. At least one full minor release cycle with both old/new behavior supported (when technically feasible).
3. Explicit migration guidance and fixture-backed compatibility tests before removal.

## Support windows
- Current major version: fully supported.
- Previous major version: critical security fixes only for 90 days after new major release.

## Enforcement
- Breaking changes require lockfile/manifest migration fixtures and CI compatibility matrix updates.
- Release workflows must generate auditable evidence artifacts and pass quality gates before publish.
