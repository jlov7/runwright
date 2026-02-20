# Gap Backlog (Release-ready v1)

## P0

### P0-019: First-run web shell still presents excessive cognitive load and weak progressive disclosure
- Evidence: baseline shell currently renders 12 top-level nav surfaces (`dashboard/profile/onboarding/challenge/campaign/coop/ranked/creator/moderation/liveops/analytics/help`), 40 buttons, and 6 forms in first render (`apps/web/index.html`, captured 2026-02-20); user feedback reports "too much stuff going on" and confusing layout/journeys.
- Impacted journey: Signup/onboarding/first success moment and early trust for non-technical users.
- Fix strategy: Implement a core-first IA model with advanced surface disclosure, guided journey strip, and lock/unlock hints while preserving power-user command bar access.
- Status: In progress

### P0-020: Onboarding guidance is functionally complete but visually and semantically fragmented
- Evidence: onboarding actions, diagnostics, coachmarks, and success criteria are split across multiple areas without a single explicit “current step + why” strip in the shell (`apps/web/index.html`); first-run users must infer sequence from multiple widgets.
- Impacted journey: First 10-minute onboarding and first-success conversion.
- Fix strategy: Introduce explicit staged journey guidance with one recommended action at a time and stronger copy for step rationale/recovery.
- Status: In progress

### P0-011: Pre-release "game client shell" coverage was still CLI-simulated, not a launchable web runtime
- Evidence: `runwright gameplay client --json` previously reported shell readiness without checking real web/runtime assets; no dedicated runtime server or web shell tests existed.
- Impacted journey: App-store style player onboarding (profile -> tutorial -> first success), in-app help/tooltips, and web/UX failure-state recovery.
- Fix strategy: Ship a real runtime API + persistent state model + launcher script + accessible web shell; wire CLI readiness checks to actual assets and add integration/UI shell tests.
- Status: Done

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

### P0-004: External GitHub Actions account/billing block on release branch heads
- Evidence: Recent pushed heads fail before workflow steps execute because GitHub Actions cannot start jobs due to account billing limits. Sample `CI`/`CodeQL` run pairs: `22109118266`/`22109118280`, `22110929744`/`22110929736`, `22111146887`/`22111146880`, `22112492942`/`22112492922`, `22112524863`/`22112524890`, `22203952764`/`22203952755`, `22240155561`/`22240155541`, and latest `8b54389` runs `22240196616`/`22240196630` (all jobs recorded `stepsCount: 0`); all annotate `job was not started` with billing/spending-limit guidance.
- Impacted journey: Final CI gate sign-off on most recent commit.
- Fix strategy: Restore GitHub billing/quota, rerun required workflows on latest head, and keep RG-007 exception evidence current until remote execution resumes.
- Status: Blocked (external platform)

### P0-002: Release gate definitions not formalized
- Evidence: No dedicated release gate document with explicit evidence requirements.
- Impacted journey: Go/no-go release decision and audit trail.
- Fix strategy: Create `RELEASE_GATES.md` with explicit gates, commands, and artifact expectations.
- Status: Done

## P1

### P1-017: Runtime browser trust boundaries lacked explicit origin/CSRF/rate-limit/session enforcement
- Evidence: Prior runtime mutation endpoints accepted browser-origin writes without explicit same-origin CSRF signaling, lacked endpoint-level request throttling controls, and did not enforce session/profile mismatch rejection when session headers were present.
- Impacted journey: Web onboarding/core-loop mutation safety, anti-abuse controls, and auth boundary trust for profile-scoped actions.
- Fix strategy: Add defensive response headers, same-origin browser CSRF/origin enforcement, configurable endpoint rate limits, and profile-scoped session boundary checks; add regression tests for browser mutation failure states and boundary behavior.
- Status: Done

### P1-018: Web shell mutations lacked live session continuity and explicit sign-out control
- Evidence: Onboarding previously created only a profile record in web shell state, so mutating actions were sent without a session header and users could not end runtime sessions from the UI.
- Impacted journey: Auth boundary clarity for non-technical users and secure session lifecycle control in the profile/core-loop flow.
- Fix strategy: Auto-create runtime session after profile signup, attach `x-session-id` on mutating browser calls, and add profile-surface logout action.
- Status: Done

### P1-016: Missing first-class release attestation generate/verify pipeline
- Evidence: Release verification relied on bundle signature/checksum plus GitHub attestation download, but there was no deterministic local attestation artifact with schema + signature verification for release evidence sets.
- Impacted journey: Release provenance confidence and downstream consumer verification portability.
- Fix strategy: Add signed attestation generation and verification scripts, schema contracts, workflow integration, and regression tests with tamper detection.
- Status: Done

### P1-015: No continuous drift watch loop for unattended hygiene
- Evidence: No `runwright watch` command existed to keep lockfile/scan/apply cycles current as skills and manifests changed.
- Impacted journey: Ongoing operations reliability and unattended drift remediation workflows.
- Fix strategy: Add `watch` command with `--once`, debounce dedupe, optional `--apply-safe`, and integration tests covering dry-run/apply behavior.
- Status: Done

### P1-014: No guided remediation command for operators
- Evidence: Recovery required chaining multiple commands manually (`scan`, `policy check`, `fix`) with no single remediation surface.
- Impacted journey: Failure recovery UX and non-technical operator confidence.
- Fix strategy: Add `runwright remediate` with non-interactive plan/apply-safe flows and interactive confirmation when a TTY is available.
- Status: Done

### P1-013: No external policy-as-code pack ingestion path
- Evidence: Policy rules could only be defined in manifest defaults, preventing team-level shared rule packs with deterministic overrides.
- Impacted journey: Policy governance portability and centralized compliance workflows.
- Fix strategy: Add JSON rule pack parser/validator, deterministic merge with manifest rules, and CLI support via `--rule-pack`.
- Status: Done

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
