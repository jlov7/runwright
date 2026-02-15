# Gap Backlog (Release-ready v1)

## P0

### P0-010: Doctor cannot run because dependencies are not installable (registry DNS)
- Evidence: `pnpm run doctor` succeeded; `reports/doctor/doctor.json` generated `2026-02-15T15:41:09.200Z` with `overall.ok: true`.
- Impacted journey: Release gate evidence collection (`reports/doctor/doctor.json`) and all local quality verification.
- Fix strategy: Restore npm registry/DNS access or configure an approved internal mirror, then rerun `pnpm install` and `pnpm run doctor`.
- Status: Done

### P0-009: Deterministic export failed in some timezones without SOURCE_DATE_EPOCH
- Evidence: `runwright export --deterministic --json` could fail with `date not in range 1980-2099` due ZIP mtime baseline using UTC midnight that resolves to 1979 local year in negative offsets.
- Impacted journey: Release artifact generation and the optional onboarding verify-bundle step.
- Fix strategy: Use local ZIP-safe baseline timestamps, enforce upper-bound SOURCE_DATE_EPOCH validation, and add integration regression tests.
- Status: Done

### P0-008: Journey skill scaffolding command still used placeholder redirection syntax
- Evidence: `runwright journey` step 2 suggested `mkdir -p skills/<skill-name> && touch skills/<skill-name>/SKILL.md`, which shell users cannot copy-paste safely because `<...>` is interpreted as redirection.
- Impacted journey: First-run onboarding and first success moment for new users.
- Fix strategy: Replace with a literal runnable example path and add regression coverage in journey UX tests.
- Status: Done

### P0-005: Journey skill-creation command was non-executable
- Evidence: `runwright journey` step 2 previously suggested `create skills/<skill-name>/SKILL.md`, which is not a valid shell command in standard environments.
- Impacted journey: First-run onboarding (technical + non-technical guided setup).
- Fix strategy: Replace with executable command and align empty-state copy to quickstart template.
- Status: Done

### P0-006: Frozen lockfile failures looked like successful apply in text mode
- Evidence: `runwright apply --frozen-lockfile` could exit `11` while still printing generic success-style apply summary and next-step copy.
- Impacted journey: Core loop failure recovery, CI-style local validation.
- Fix strategy: Introduce explicit failure rendering (`Apply Failed`) with lockfile-specific reason and recovery actions.
- Status: Done

### P0-007: Journey progress did not detect stale safety/install evidence
- Evidence: `runwright journey` could show `6/6` complete after skill changes without rerunning `update`/`scan`/`apply`.
- Impacted journey: Ongoing core loop trust and release-readiness confidence.
- Fix strategy: Add freshness checks using file mtimes + operation event timestamps; downgrade stale steps back to pending with explicit rerun guidance.
- Status: Done

### P0-001: Missing executable doctor gate
- Evidence: `pnpm run doctor` writes `reports/doctor/doctor.json` with all checks passing (`overall.ok: true`, latest generated `2026-02-14T22:34:07.685Z`).
- Impacted journey: Release manager sign-off and repeatable release verification.
- Fix strategy: Add `scripts/doctor.ts`, add `doctor` package script, emit machine-readable gate results.
- Status: Done

### P0-003: Latest-head CI evidence missing
- Evidence: Latest head `669df6d` is green in GitHub Actions (`CI` run `22020438502`, `CodeQL` run `22020438501`) and local doctor evidence is fresh (`reports/doctor/doctor.json`, generated `2026-02-14T16:25:29.080Z`, `overall.ok: true`).
- Impacted journey: Final release sign-off on current release branch head.
- Fix strategy: Push branch head, wait for `CI` and `CodeQL` to succeed, then record run IDs in docs.
- Status: Done

### P0-004: External GitHub Actions startup instability on latest head
- Evidence: Latest head `9a9d5c1` still fails immediately in both workflows with zero executed steps even after rerun (`CI` run `22020736688`, `CodeQL` run `22020736679`; failed jobs include `63641142163`, `63641142175`, `63641142179`, `63641142329` with `steps: []`).
- Impacted journey: Final CI gate sign-off on most recent commit.
- Fix strategy: Retry once service stabilizes; keep release evidence anchored to last known-good CI head (`669df6d`) plus fresh local doctor artifacts.
- Status: Blocked (external platform)

### P0-002: Release gate definitions not formalized
- Evidence: No dedicated release gate document with explicit evidence requirements.
- Impacted journey: Go/no-go release decision and audit trail.
- Fix strategy: Create `RELEASE_GATES.md` with explicit gates, commands, and artifact expectations.
- Status: Done

## P1

### P1-012: Apply transactions lacked crash-recovery workflow
- Evidence: interrupted filesystem apply operations had no first-class recovery command, leaving operators to manually inspect `.skillbase` state.
- Impacted journey: Core apply reliability, operator trust, and incident recovery speed.
- Fix strategy: Add persisted apply journal + `runwright apply-resume` command and block apply when stale journal exists until recovered.
- Status: Done

### P1-011: Missing team-level signed bundle sync workflow
- Evidence: No built-in command existed to publish and retrieve signed release bundles from a shared registry location with digest/signature checks.
- Impacted journey: Team collaboration, release handoff, and trust-preserving artifact reuse.
- Fix strategy: Add `runwright registry push|pull` with ed25519 signing/verification, registry index persistence, and integration tests.
- Status: Done

### P1-010: Release scripts lacked built-in usage/help guidance
- Evidence: `scripts/doctor.ts` and `scripts/verify_quality_evidence.ts` previously returned parser errors for `--help` requests instead of self-service usage output.
- Impacted journey: Operator onboarding and CI/debug troubleshooting speed.
- Fix strategy: Add explicit `--help`/`-h` usage renderers and cover behavior in script tests.
- Status: Done

### P1-009: `init` re-runs exited nonzero and looked like failures
- Evidence: running `runwright init` in an already initialized workspace returned status `2`, creating unnecessary friction for non-technical users and CI wrappers expecting idempotent setup.
- Impacted journey: First-run onboarding retries and automation reliability.
- Fix strategy: Make `init` idempotent-success with explicit "already initialized" guidance and keep operation-event mutating semantics accurate.
- Status: Done

### P1-008: Optional bundle verification step did not expire when project inputs changed
- Evidence: `runwright journey` could continue showing optional verify-bundle as complete after manifest/skills updates, leaving stale release assurance cues.
- Impacted journey: Ongoing core loop clarity and release confidence.
- Fix strategy: Add freshness checks for verify-bundle events and regression tests covering stale transition behavior.
- Status: Done

### P1-007: Doctor script tolerated malformed CLI arguments
- Evidence: `scripts/doctor.ts` previously accepted unknown flags and missing values, which could silently run unintended checks in automation.
- Impacted journey: Release gate reproducibility and CI diagnostics.
- Fix strategy: Enforce strict doctor arg validation and clean top-level error output; add regression tests for malformed args.
- Status: Done

### P1-006: Quality evidence script accepted malformed/unknown arguments silently
- Evidence: `scripts/verify_quality_evidence.ts` previously treated missing flag values and unknown arguments as implicit defaults, producing misleading downstream file-read errors.
- Impacted journey: CI/release automation diagnostics and operator self-service troubleshooting.
- Fix strategy: Enforce strict CLI arg parsing (required values, numeric validation, unknown-flag rejection) and add regression tests.
- Status: Done

### P1-003: Semantic flag validation was deferred behind manifest loading
- Evidence: `runwright apply --scan-security severe` in a fresh directory previously surfaced `missing-manifest` instead of invalid flag value.
- Impacted journey: Error-state diagnosis and self-service correction.
- Fix strategy: Add early semantic flag validation before manifest load for relevant commands.
- Status: Done

### P1-004: Verify-bundle text mode lacked consistent human-readable UX
- Evidence: Operators relying on non-JSON output had less structured verification failure messaging.
- Impacted journey: Manual release checks and non-technical review handoffs.
- Fix strategy: Add dedicated text-mode renderer for verify-bundle success/failure with actionable next steps.
- Status: Done

### P1-005: `quality:evidence:verify` script unusable without manual args
- Evidence: `pnpm quality:evidence:verify` failed immediately with `Missing required --scorecard argument`, despite being listed as a standard command.
- Impacted journey: Operator quality evidence verification and release gate automation.
- Fix strategy: Add sensible default scorecard path/output in script and regression test for no-arg invocation.
- Status: Done

### P1-001: Gap loop algorithm not enforced in working agreement
- Evidence: Prior `AGENTS.md` loop stopped at milestone planning semantics and did not define strict stop conditions.
- Impacted journey: Autonomous product hardening pass from planning to completion.
- Fix strategy: Add strict Gap Loop algorithm and stop conditions to `AGENTS.md`.
- Status: Done

### P1-002: Prioritized gap register missing
- Evidence: No dedicated backlog file with priority, evidence, journey impact, and strategy.
- Impacted journey: Methodical iteration across remaining release risk.
- Fix strategy: Maintain this `GAPS.md` and update statuses after each loop iteration.
- Status: Done

## P2

### P2-002: Non-technical docs lacked explicit pass/fail interpretation guidance
- Evidence: Stakeholder docs described outcomes but did not provide quick interpretation for `blocked`, status `11`, or verification failures.
- Impacted journey: PM/compliance review without source-code dependency.
- Fix strategy: Add plain-language status interpretation and compatibility naming notes.
- Status: Done

### P2-001: Product decision defaults still open
- Evidence: `QUESTIONS.md` previously contained open release-channel and signing-mode decisions.
- Impacted journey: Final release policy hardening and operator clarity.
- Fix strategy: Record explicit product defaults for distribution channel and required signing mode.
- Status: Done
