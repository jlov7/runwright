# Frontend Motion Choreography System

## Timing map
- Enter transitions: `--motion-base` (200ms)
- Exit transitions: `--motion-fast` (120ms)
- Context-switch transitions: `--motion-slow` (340ms)

## Choreography rules
- Prioritize intent clarity: motion should explain state changes, not decorate them.
- Use staggered reveals for loading/progressive content.
- Keep motion consistent across nav, overlays, toasts, and panel transitions.
- Honor reduced-motion across all animated surfaces.

## Applied surfaces
- Nav activation and hover lift.
- Toast entrance/exit cadence.
- Skeleton shimmer for progressive reveal.
- Ambient aurora background in standard motion mode.
