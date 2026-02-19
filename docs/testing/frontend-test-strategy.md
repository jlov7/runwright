# Frontend Test Strategy (100/100 Program)

## Goals
1. Prevent regressions in primary user journeys.
2. Validate accessibility and responsive behavior as first-class quality gates.
3. Provide fast signal in PRs and deep signal in release gates.

## Test Pyramid

### Layer A: Unit (fast)
Scope:
- Shared UI primitives.
- Utility functions and formatters.
- Typed API client helpers and state transforms.

Target:
- High branch coverage for shared logic.

### Layer B: Integration (medium)
Scope:
- Feature modules with mocked runtime responses.
- Onboarding/funnel state transitions.
- Error and recovery UX behavior.

Target:
- All primary workflows represented at least once.

### Layer C: E2E (deep confidence)
Scope:
- Signup/onboarding/first success.
- Core loop (save/sync/challenge/ranked).
- Failure states (network/offline/ranked rejection/moderation error).
- Accessibility keyboard path and basic SR semantics.

Target:
- Deterministic test suite with artifacts on failure.

## Quality Gates
Per milestone:
- Targeted tests for changed areas.
- Full gate: `pnpm verify`.
- Evidence refresh: `pnpm run doctor`, `pnpm quality:evidence:verify`, `pnpm ship:gate`.
- Coverage gate: `pnpm test:coverage` (frontend/runtime module thresholds enforced in CI).
- Visual regression gate: `pnpm test:visual`.
- Accessibility/mobile regression gate: `pnpm test:web-a11y`.

## Flake Policy
- Any flaky E2E test is quarantined within one day.
- Quarantined tests require a follow-up fix issue.
- No release candidate can ship with unresolved high-impact flakes.
- Process reference: `docs/testing/frontend-deflake-policy.md`.

## Coverage Targets
- Unit/integration: >= 85% lines on frontend modules.
- E2E: all critical journeys and top 5 failure journeys covered.

## Artifact Outputs
- Test summary report.
- Failure screenshots/traces for E2E.
- Coverage report with trend deltas.
- Journey matrix reference: `docs/testing/frontend-integration-journeys.md`.
