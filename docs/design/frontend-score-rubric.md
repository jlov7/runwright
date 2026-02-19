# Frontend 100/100 Scoring Rubric

## Purpose
Define objective evidence requirements to score each frontend criterion from 0-100 and remove subjective drift.

## Scoring Model
- 0-39: Failing baseline; major UX breakage or missing core surfaces.
- 40-59: Functional MVP; noticeable usability and architecture gaps.
- 60-79: Strong production quality; clear remaining polish/depth gaps.
- 80-94: Excellent; minor edge/craft gaps remain.
- 95-99: Near world-class; only tiny non-blocking gaps.
- 100: World-class evidence-complete, no material findings.

## Criteria and Required Evidence

### 1. Visual design language & brand polish
Required evidence:
- Tokenized design system documentation.
- Visual regression baselines for primary screens.
- Manual consistency QA report (spacing/type/color).

### 2. Information architecture & clarity
Required evidence:
- Navigation map and route hierarchy.
- Five persona walkthrough scripts with pass results.
- Empty-state and page-structure standards in implementation.

### 3. Onboarding / first-success journey
Required evidence:
- State machine spec for onboarding.
- Funnel telemetry (step conversion + completion time).
- E2E tests for happy path and top failure routes.

### 4. Interaction quality
Required evidence:
- Unified interaction state model implementation.
- Async state UX checks (loading/retry/success/failure).
- Regression tests on state transition behavior.

### 5. Error handling & recovery UX
Required evidence:
- Error taxonomy mapped to runtime/API codes.
- Recovery copy standards with next actions.
- Failure-injection tests proving recoverability.

### 6. Accessibility fundamentals
Required evidence:
- Automated accessibility scan artifacts.
- Manual keyboard + screen-reader check report.
- WCAG contrast and focus-management verification.

### 7. Mobile/responsive quality
Required evidence:
- Responsive breakpoint standards.
- Device matrix test artifacts (mobile/tablet/desktop).
- Visual and functional responsive regressions passing.

### 8. Frontend architecture maintainability
Required evidence:
- Architecture ADR and module boundary rules.
- Typed API client and state boundary implementation.
- Static analysis checks enforcing boundaries.

### 9. Performance basics
Required evidence:
- Budget definition and CI threshold checks.
- Page/profile performance snapshots.
- Regression alerts and trend tracking.

### 10. Frontend testing depth
Required evidence:
- Strategy doc + coverage targets.
- Unit/integration/E2E layers in CI.
- Flake management policy.

### 11. Product completeness of core UI surfaces
Required evidence:
- Surface inventory with status (dashboard/profile/onboarding/campaign/co-op/ranked/creator/mod/help/etc).
- Empty/loading/error/success states present per surface.
- Per-surface accessibility/responsive signoff.

### 12. World-class feel (craft/delight/cohesion)
Required evidence:
- Motion choreography spec and implementation.
- Copy tone and trust-cue consistency report.
- Expert critique rounds with resolved findings.

## 100/100 Gate
A criterion can only be scored 100 when all tasks in its workstream are complete, all required evidence exists in-repo, tests/gates pass, and no high-severity findings remain.
