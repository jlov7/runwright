# Frontend Maintainability Checklist

Use this checklist before merging frontend architecture changes.

## Architecture
- [ ] Layer boundaries respected (`app/features/entities/shared`).
- [ ] No shared-layer upward imports.
- [ ] API calls routed through typed client boundary.

## Types and Tests
- [ ] `pnpm typecheck` passes.
- [ ] Unit tests added/updated for primitives/state changes.
- [ ] Integration/E2E impacts considered and tracked.

## UX Safety
- [ ] Loading/error/recovery states preserved or improved.
- [ ] Accessibility affordances preserved (labels/focus/live regions where relevant).
- [ ] Responsive behavior checked for touched surfaces.

## Evidence
- [ ] Relevant plan/todo trackers updated.
- [ ] Release dashboard score impact recorded.
