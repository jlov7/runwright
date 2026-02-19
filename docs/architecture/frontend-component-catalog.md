# Frontend Component Catalog (Foundation)

## Purpose
Provide a stable inventory of reusable primitives before scaling feature surfaces.

## Shared Primitives (v1 foundation)
- `panelClass(variant)` in `apps/web/src/shared/ui/primitives.ts`
  - Standardizes panel variant class mapping.
- `buttonLabel(base, state)` in `apps/web/src/shared/ui/primitives.ts`
  - Encodes async state labels for consistent action copy.
- `feedbackClass(state)` in `apps/web/src/shared/ui/primitives.ts`
  - Unifies feedback severity styling hooks.
- `badgeTone(score)` in `apps/web/src/shared/ui/primitives.ts`
  - Maps quality score to canonical tone buckets.

## State Foundation
- `createFrontendStore` and `reduceFrontendState` in `apps/web/src/app/state-store.ts`
  - Centralized UI state transitions for navigation, async state, errors, and journey completion.

## Evolution Rules
- New shared primitives require:
  - Unit tests in `tests/frontend-ui-primitives.test.ts` or equivalent.
  - Naming consistent with existing tone/variant/state conventions.
- New state actions require:
  - Reducer transition tests in `tests/frontend-state-store.test.ts`.
