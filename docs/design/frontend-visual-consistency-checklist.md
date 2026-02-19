# Frontend Visual Consistency Checklist

## Screen-entry checklist (required)
- Uses semantic color tokens only (no ad-hoc hex values in markup).
- Uses typography scale tokens (`--font-size-*`) and display/body family contract.
- Uses spacing/radius/elevation tokens (`--space-*`, `--radius-*`, `--elevation-*`).
- Provides explicit loading, empty, success, and error state treatment.
- Includes keyboard focus visibility and live region/status copy where async work exists.

## Motion and transitions
- Uses choreographed timing tiers (`fast`, `base`, `slow`) with purpose.
- Includes reduced-motion fallback for all meaningful animation.
- Avoids abrupt layout jumps during loading or surface transitions.

## Responsive requirements
- Works across desktop, tablet, and phone breakpoints.
- Maintains minimum 44x44 action targets on touch layouts.
- Preserves hierarchy and readability at 200% zoom.

## Verification commands
- `pnpm test:web-a11y`
- `pnpm test:visual`
- `pnpm perf:frontend:check`
