# Web UX Simplification World-class Pass Implementation Plan

> **For Claude/Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the web runtime shell from feature-dense to guided-first, with progressive disclosure, clear recovery paths, and reduced first-run cognitive load.

**Architecture:** Keep the existing runtime APIs and core surfaces, but change presentation and interaction orchestration so first-run users see only a guided core path. Move surface navigation rules into a dedicated module, reduce visible controls until prerequisites are met, and add explicit journey/status context.

**Tech Stack:** Static web shell (`apps/web/index.html`, `apps/web/styles.css`), lightweight browser modules (`apps/web/*.js`), Vitest.

---

## Baseline Evidence (2026-02-20)
- `apps/web/index.html`: 1700 lines.
- `apps/web/styles.css`: 672 lines.
- Primary nav surfaces visible up front: 12.
- Interactive density in first render: 40 buttons, 6 forms, 7 inputs, 5 selects.
- Baseline gate: `pnpm run doctor` passed with fresh artifact at `reports/doctor/doctor.json` (`generatedAt: 2026-02-20T21:38:41.731Z`).

## Persona Targets
1. New evaluator: understand value and complete first success in <10 minutes.
2. Non-technical operator: clear next action, no dead-end states, safe recovery copy.
3. Returning power user: fast access to advanced surfaces without blocking.
4. Accessibility-first user: reliable keyboard flow, focus and labels preserved.

## Phase Plan

### Phase 1: IA And Navigation Simplification (P0)
- [x] Add a single source-of-truth navigation model (`core` vs `advanced` surfaces).
- [x] Show only `dashboard/profile/onboarding/help` in default nav.
- [x] Add explicit advanced toggle with clear state (`Show advanced surfaces` / `Hide advanced surfaces`).
- [x] Auto-open advanced surfaces after first-success completion.
- [x] Keep command bar power path intact for returning users.
- [x] Add lock reasons and unlock hints for blocked advanced surfaces.
- [x] Update mobile nav options to follow the same disclosure rules.
- [x] Add tests for nav section composition and lock-reason logic.

### Phase 2: Guided First-success Journey (P0)
- [x] Add visible guided journey strip (step status + current next step).
- [x] Convert onboarding controls into a staged path with one recommended CTA at a time.
- [x] Add explicit “Why this step matters” copy per onboarding action.
- [x] Ensure failure copy includes next action + fallback path.
- [x] Add tests for first-success progression copy and state transitions.

### Phase 3: Error, Empty State, And Help Clarity (P0)
- [x] Standardize empty-state structure: reason, action, fallback.
- [x] Tighten error copy taxonomy for network, validation, auth, and transient runtime failures.
- [x] Add contextual tooltips for high-risk actions only.
- [x] Improve recovery playbooks with concrete “do this now” commands.
- [x] Add tests for updated error/empty/help copy guarantees.

### Phase 4: Surface Density And Layout Polish (P1)
- [x] Reduce above-the-fold competing panels for first-run state.
- [x] Simplify header copy and de-emphasize low-priority controls.
- [x] Improve spacing hierarchy and typography contrast for scanability.
- [x] Reduce decorative visual noise in constrained/mobile layouts.
- [x] Update visual baseline hashes after intentional changes.

### Phase 5: Accessibility And Keyboard Refinement (P1)
- [x] Preserve skip links/landmarks while changing IA.
- [x] Ensure keyboard-only access for advanced toggle + guided CTAs.
- [x] Ensure aria-live output avoids repetitive noisy announcements.
- [x] Validate focus return behavior after surface transitions.
- [x] Add/adjust accessibility guard tests.

### Phase 6: Verification And Release Evidence (P0 Exit)
- [x] Run targeted frontend test suites.
- [x] Run `pnpm verify`.
- [x] Run `pnpm run doctor`.
- [x] Refresh `GAPS.md`, `TODO.md`, and `RELEASE_CHECKLIST.md` evidence.
- [x] Record post-pass findings and remaining non-blocking enhancements in `QUESTIONS.md` if any.

## Exit Criteria
- First-run nav exposes only core path surfaces by default.
- Onboarding first-success sequence is explicit and understandable without prior product knowledge.
- Key failure states include actionable recovery guidance.
- Frontend regression, accessibility, and quality gates pass.
