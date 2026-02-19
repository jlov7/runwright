# Frontend 100/100 Excellence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Raise all 12 frontend criteria to 100/100 through a fully tracked, evidence-backed execution program.

**Architecture:** Keep the current runtime API contract (`src/game/runtime.ts`) and replace the current static shell with a production frontend system (typed app, component architecture, robust testing, and UX quality gates). Build in thin vertical slices so each milestone ships user-visible value while preserving release reliability.

**Tech Stack:** TypeScript, modern web app architecture under `apps/web`, existing Node runtime APIs, Vitest/Playwright, lint/typecheck/build CI gates, accessibility/performance tooling.

---

## 1) Baseline -> Target Matrix

| Criterion | Baseline | Target |
| --- | ---: | ---: |
| Visual design language & brand polish | 58 | 100 |
| Information architecture & clarity | 66 | 100 |
| Onboarding / first-success journey | 74 | 100 |
| Interaction quality | 60 | 100 |
| Error handling & recovery UX | 68 | 100 |
| Accessibility fundamentals | 72 | 100 |
| Mobile/responsive quality | 59 | 100 |
| Frontend architecture maintainability | 52 | 100 |
| Performance basics | 84 | 100 |
| Frontend testing depth | 67 | 100 |
| Product completeness of core UI surfaces | 49 | 100 |
| World-class feel (craft/delight/cohesion) | 54 | 100 |

## 2) Program Rules

1. No milestone closes without passing quality gates (`pnpm verify`, `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`).
2. Every task must have artifact evidence (code, test, screenshot, docs, telemetry report, or gate output).
3. Execute in small logical increments (max 5 files/change by default).
4. Keep runtime API compatibility unless an explicit migration task is scheduled.
5. CI external billing incidents use RG-007 exception policy but do not block local execution.

## 3) Global Milestones (Execution Order)

- M0 Foundation and scoring infrastructure.
- M1 Frontend architecture modernization.
- M2 Design system and visual language.
- M3 Information architecture and core navigation.
- M4 Onboarding and first-success funnel perfection.
- M5 Interaction quality + resilient error recovery.
- M6 Accessibility and responsive/mobile excellence.
- M7 Product surface completeness.
- M8 Performance, testing depth, and world-class polish.
- M9 Final panel rehearsal, hardening, and release signoff.

## 4) Master Task Backlog (Exhaustive)

### WS-01 Visual Design Language & Brand Polish (VD)
- [ ] VD-01: Define brand attributes, tone, and visual principles; publish style brief in `docs/design/brand-principles.md`.
- [ ] VD-02: Create semantic color token system with light/dark and state tokens (`success/warning/error/info`).
- [ ] VD-03: Define typography scale, rhythm, and hierarchy tokens.
- [ ] VD-04: Build spacing, radius, elevation, and motion tokens.
- [ ] VD-05: Implement foundational layout primitives (`Page`, `Panel`, `Stack`, `Inline`, `Grid`).
- [ ] VD-06: Build shared icon set and usage rules.
- [ ] VD-07: Add visual consistency lint/checklist for new screens.
- [ ] VD-08: Replace one-off inline styles with tokenized design system usage.
- [ ] VD-09: Establish screenshot baseline suite for visual quality.
- [ ] VD-10: Run final visual QA pass for color/spacing/typography consistency.

### WS-02 Information Architecture & Clarity (IA)
- [ ] IA-01: Define global navigation model and route map.
- [ ] IA-02: Define top-level product areas and canonical naming.
- [ ] IA-03: Implement persistent navigation shell with active state.
- [ ] IA-04: Add breadcrumbs/wayfinding for deep workflows.
- [ ] IA-05: Standardize page-level hierarchy pattern (title, intent, status, primary CTA).
- [ ] IA-06: Define content design rules for labels, helper text, and empty states.
- [ ] IA-07: Implement decision-tree empty states with contextual next actions.
- [ ] IA-08: Add command/search affordance to jump to key flows.
- [ ] IA-09: Add page-level success criteria indicators (“what good looks like”).
- [ ] IA-10: Validate IA with five persona walkthrough scripts.

### WS-03 Onboarding / First Success Journey (ON)
- [ ] ON-01: Define persona-based onboarding funnels and success moments.
- [ ] ON-02: Implement onboarding state machine (not ad hoc UI booleans).
- [ ] ON-03: Add step-by-step interactive checklist with persistence.
- [ ] ON-04: Add contextual coachmarks with dismiss/revisit behavior.
- [ ] ON-05: Add “skip for now” and “resume later” journey controls.
- [ ] ON-06: Add sample data/bootstrap mode for instant first success.
- [ ] ON-07: Add progress celebration states at key milestones.
- [ ] ON-08: Add onboarding diagnostics view for funnel drop-off causes.
- [ ] ON-09: Add telemetry for each onboarding step transition.
- [ ] ON-10: Add E2E tests for happy path + top 5 failure paths.

### WS-04 Interaction Quality (IX)
- [ ] IX-01: Define interaction state model for all async actions (idle/loading/success/error/retrying).
- [ ] IX-02: Standardize button/input states across app components.
- [ ] IX-03: Add optimistic updates where safe, with deterministic rollback.
- [ ] IX-04: Add unified feedback system (inline + toast + persistent status where needed).
- [ ] IX-05: Add undo affordances for reversible destructive actions.
- [ ] IX-06: Add keyboard shortcuts and command palette for power users.
- [ ] IX-07: Add loading skeletons and progressive reveal patterns.
- [ ] IX-08: Add microinteraction timing standards and enforce them in components.
- [ ] IX-09: Add interaction latency budget alerts in dev mode.
- [ ] IX-10: Add UX regression tests for interaction state transitions.

### WS-05 Error Handling & Recovery UX (ER)
- [ ] ER-01: Create frontend error taxonomy mapped to runtime/API error codes.
- [ ] ER-02: Create reusable error message formatter (plain language, next action, support code).
- [ ] ER-03: Add global error boundary with actionable recovery links.
- [ ] ER-04: Add inline form validation with prevention (before submit) and recovery (after fail).
- [ ] ER-05: Add offline/online network state banners and recovery actions.
- [ ] ER-06: Add retry/backoff queue UX for transient failures.
- [ ] ER-07: Add “copy diagnostic packet” for support/debug handoff.
- [ ] ER-08: Add recovery playbooks into in-app help context.
- [ ] ER-09: Add failure-injection tests for top runtime endpoints.
- [ ] ER-10: Add E2E tests proving all key failures have clear next actions.

### WS-06 Accessibility Fundamentals (A11Y)
- [ ] A11Y-01: Run baseline automated audit and manual keyboard/screen-reader audit.
- [ ] A11Y-02: Add semantic landmarks and heading hierarchy on all primary screens.
- [ ] A11Y-03: Ensure all controls have explicit labels and description relationships.
- [ ] A11Y-04: Implement skip links and deterministic focus management on route/action changes.
- [ ] A11Y-05: Fix contrast violations to WCAG AA minimums; prefer AAA where practical.
- [ ] A11Y-06: Implement reduced motion support for all meaningful animation.
- [ ] A11Y-07: Add live region announcements for async status changes.
- [ ] A11Y-08: Ensure app is usable at 200% zoom and large text.
- [ ] A11Y-09: Expand input remap/controller mappings and test coverage.
- [ ] A11Y-10: Add a11y regression checks into CI.

### WS-07 Mobile / Responsive Quality (MB)
- [ ] MB-01: Define responsive breakpoint strategy and device class rules.
- [ ] MB-02: Implement mobile-first navigation pattern.
- [ ] MB-03: Ensure all tap targets are at least 44x44 CSS px.
- [ ] MB-04: Rework forms for mobile ergonomics (keyboard types, input modes, spacing).
- [ ] MB-05: Add responsive type/spacing scaling rules for small screens.
- [ ] MB-06: Optimize layout stability to avoid content jumps on mobile.
- [ ] MB-07: Add device matrix QA scripts (iOS Safari, Android Chrome, tablets, desktop).
- [ ] MB-08: Add orientation change resilience tests.
- [ ] MB-09: Add mobile-specific loading/empty/error variants where needed.
- [ ] MB-10: Add responsive visual regression baselines.

### WS-08 Frontend Architecture Maintainability (ARC)
- [x] ARC-01: Choose and lock frontend architecture pattern (typed modular app under `apps/web`).
- [x] ARC-02: Define folder/module boundaries (`app`, `features`, `entities`, `shared`).
- [x] ARC-03: Introduce strict TypeScript config and no-implicit-any enforcement for frontend code.
- [x] ARC-04: Build typed API client layer with shared contract types.
- [ ] ARC-05: Introduce state management strategy (server state + UI state boundaries).
- [ ] ARC-06: Create reusable component library foundation.
- [ ] ARC-07: Add Storybook/component documentation (or equivalent) for core components.
- [ ] ARC-08: Add ADRs for architecture decisions and constraints.
- [ ] ARC-09: Add static analysis rules to prevent architecture boundary violations.
- [ ] ARC-10: Add maintainability checklist gate before merges.

### WS-09 Performance Basics (PF)
- [ ] PF-01: Define measurable budgets (bundle size, LCP, INP, CLS, TTI, memory).
- [ ] PF-02: Implement route/code splitting and lazy loading.
- [ ] PF-03: Optimize font loading strategy and reduce render-blocking assets.
- [ ] PF-04: Optimize API request patterns (dedupe/cache/stale-while-revalidate).
- [ ] PF-05: Remove unnecessary rerenders via memoization/profiling fixes.
- [ ] PF-06: Add performance telemetry capture and dashboard.
- [ ] PF-07: Add Lighthouse or equivalent CI performance checks.
- [ ] PF-08: Add runtime perf debug overlay for local diagnosis.
- [ ] PF-09: Add regression alerting when budget thresholds are crossed.
- [ ] PF-10: Run perf soak tests on low-end device profiles.

### WS-10 Frontend Testing Depth (TST)
- [x] TST-01: Define frontend test strategy and coverage targets by layer.
- [ ] TST-02: Add unit tests for shared UI primitives.
- [ ] TST-03: Add unit tests for hooks/state logic.
- [ ] TST-04: Add integration tests for all primary user journeys.
- [ ] TST-05: Add E2E tests for onboarding, core loop, error recovery, ranked, creator.
- [ ] TST-06: Add accessibility tests in component and E2E layers.
- [ ] TST-07: Add visual regression tests for key screens/states.
- [ ] TST-08: Add API contract tests for frontend/runtime compatibility.
- [ ] TST-09: Set coverage thresholds and enforce in CI.
- [ ] TST-10: Add flake quarantine and deflake process for E2E stability.

### WS-11 Product Completeness of Core UI Surfaces (CMP)
- [ ] CMP-01: Ship home dashboard surface.
- [ ] CMP-02: Ship account/profile/settings surface.
- [ ] CMP-03: Ship onboarding center surface.
- [ ] CMP-04: Ship challenge/quest surface.
- [ ] CMP-05: Ship campaign/progression surface.
- [ ] CMP-06: Ship co-op/social surface.
- [ ] CMP-07: Ship ranked/leaderboard surface.
- [ ] CMP-08: Ship creator studio surface.
- [ ] CMP-09: Ship moderation/reporting surface.
- [ ] CMP-10: Ship liveops/events surface.
- [ ] CMP-11: Ship analytics/diagnostics surface.
- [ ] CMP-12: Ship in-app help center surface.
- [ ] CMP-13: Ensure every surface has empty/loading/error/success states.
- [ ] CMP-14: Ensure every surface has accessibility and responsive signoff.

### WS-12 World-class Feel, Delight, and Cohesion (WOW)
- [ ] WOW-01: Define motion choreography system (enter/exit/transition timing map).
- [ ] WOW-02: Add premium transitions and staggered reveals for key flows.
- [ ] WOW-03: Add success/failure feedback polish layer (microcopy + visual treatment).
- [ ] WOW-04: Add consistent emotional tone pass for all UX copy.
- [ ] WOW-05: Add trust cues (security, data safety, status visibility) throughout app.
- [ ] WOW-06: Add delight moments at first success and milestone completions.
- [ ] WOW-07: Add perceived-performance UX (skeleton cadence, optimistic acknowledgement).
- [ ] WOW-08: Run 3 rounds of expert UX critique and integrate findings.
- [ ] WOW-09: Run 2 rounds of engineering panel technical critique and integrate findings.
- [ ] WOW-10: Final craft polish sweep (spacing, alignment, contrast, motion, copy).

### WS-13 Program Governance & Release Gates (PRG)
- [x] PRG-01: Create scoring rubric with evidence requirements for each criterion.
- [x] PRG-02: Define objective threshold for 100/100 readiness per criterion.
- [x] PRG-03: Add release dashboard page summarizing all 12 criterion scores.
- [ ] PRG-04: Add weekly quality review cadence and score delta tracking.
- [ ] PRG-05: Add blocker escalation workflow (design, engineering, product).
- [ ] PRG-06: Add pre-release dry-run checklist with signoff owners.
- [ ] PRG-07: Add final panel demo script and evidence deck.
- [ ] PRG-08: Add post-demo feedback intake and fast-fix sprint plan.

## 5) Milestone-to-Task Mapping

- M0: PRG-01..PRG-03, ARC-01..ARC-04.
- M1: ARC-05..ARC-10, TST-01..TST-03.
- M2: VD-01..VD-06, IA-01..IA-04.
- M3: IA-05..IA-10, CMP-01..CMP-04.
- M4: ON-01..ON-10, CMP-05.
- M5: IX-01..IX-10, ER-01..ER-05.
- M6: ER-06..ER-10, A11Y-01..A11Y-10, MB-01..MB-05.
- M7: MB-06..MB-10, CMP-06..CMP-14.
- M8: PF-01..PF-10, TST-04..TST-10.
- M9: WOW-01..WOW-10, PRG-04..PRG-08, final signoff.

## 6) Validation Gates Per Milestone

1. Targeted tests for touched surfaces.
2. `pnpm verify`.
3. `pnpm run doctor`.
4. `pnpm quality:evidence:verify`.
5. `pnpm ship:gate`.
6. Criterion score update with evidence links.

## 7) 100/100 Definition (Per Criterion)

A criterion reaches 100 only when:
1. All tasks in its workstream are complete.
2. No critical/high UX defects remain open in that workstream.
3. Automated checks for that workstream are passing.
4. Manual expert review passes with no material findings.
5. Evidence is published in docs and reproducible from repo commands.

## 8) Risks and Mitigations

- Risk: Scope explosion while rebuilding frontend architecture.
  - Mitigation: Vertical slice delivery and hard milestone exit criteria.
- Risk: Polished visuals but weak technical foundations.
  - Mitigation: Architecture and testing milestones come before polish milestones.
- Risk: High test flake in E2E.
  - Mitigation: dedicated deflake policy and deterministic fixture strategy.
- Risk: External CI billing lockout blocks green remote checks.
  - Mitigation: maintain RG-007 exception evidence and rerun when billing restored.

## 9) Immediate Next Execution Command

Begin with M0:
1. PRG-01 scoring rubric artifact.
2. ARC-01 architecture decision and frontend module scaffolding.
3. TST-01 frontend test strategy artifact.
