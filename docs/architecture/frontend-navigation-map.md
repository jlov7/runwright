# Frontend Navigation Map (M2)

## Purpose
Define the global navigation model and canonical naming for primary product areas.

## Global Navigation Model
- Persistent top navigation is visible on every primary runtime surface.
- Navigation uses a single active state to show current context.
- Breadcrumbs provide local wayfinding for deeper workflow context.

## Canonical Surface Names
- `Dashboard`: launch status, first action summary, diagnostics snapshot.
- `Onboarding`: first-run setup, guided checklist, first success progress.
- `Challenge`: generated missions and quest objectives.
- `Ranked`: competitive submissions and leaderboard state.
- `Creator`: level publishing and moderation status.
- `Help`: docs, troubleshooting, and recovery guidance.

## Route Map (v1 Shell)
- `/` -> `Dashboard`
- `/?surface=onboarding` -> `Onboarding`
- `/?surface=challenge` -> `Challenge`
- `/?surface=ranked` -> `Ranked`
- `/?surface=creator` -> `Creator`
- `/?surface=help` -> `Help`

## Breadcrumb Convention
- Root format: `Home / <Surface>`
- Deep workflow format: `Home / <Surface> / <Flow Step>`
- Breadcrumb labels always match canonical surface names.

## Active State Rules
- Exactly one top-nav item has `aria-current="page"` at a time.
- Active nav item uses stronger contrast and border treatment.
- Route changes must update both active nav and breadcrumb in the same render tick.
