# Frontend Brand Principles (Runwright Runtime)

## Purpose
Define a stable visual language for the runtime shell so new surfaces stay cohesive, readable, and launch-ready.

## Brand Attributes
- Confident: clear hierarchy, explicit status, no ambiguous copy.
- Tactical: operational feel with visible progress and next action.
- Trustworthy: recovery guidance is always visible near risky actions.
- Efficient: low-friction controls for both new and expert users.

## Tone And Copy Rules
- Prefer direct verbs: "Create profile", "Save progress", "Retry publish".
- Every error must include one clear next action.
- Use plain language over internal terminology unless the term is user-visible in commands.

## Color Token System

### Core Semantic Tokens
- `--color-bg-app`
- `--color-bg-surface`
- `--color-bg-panel`
- `--color-border-muted`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-link`
- `--color-focus-ring`

### State Tokens
- `--color-state-success`
- `--color-state-warning`
- `--color-state-error`
- `--color-state-info`

### Theme Contract
- Light mode uses neutral surfaces with dark text for daytime readability.
- Dark mode preserves contrast and depth for control-room style sessions.
- Accent and state hues remain semantically stable across themes.

## Typography Tokens
- `--font-family-base`: body copy and controls.
- `--font-family-display`: page titles and large headings.
- `--font-size-100` through `--font-size-700`: predictable scale steps.
- `--line-height-tight`, `--line-height-base`, `--line-height-relaxed`.
- `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold`.

## Spacing, Radius, Elevation, Motion Tokens
- Spacing: `--space-1` through `--space-8`.
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`.
- Elevation: `--elevation-1`, `--elevation-2`, `--elevation-3`.
- Motion: `--motion-fast`, `--motion-base`, `--motion-slow`.
- Motion easing: `--easing-standard`, `--easing-emphasized`.

## Layout Primitives
- `Page`: app-level content container with responsive gutters.
- `Panel`: bordered and elevated information block.
- `Stack`: vertical spacing rhythm for related controls.
- `Inline`: horizontal alignment for compact control rows.
- `Grid`: responsive card/section composition.

## Icon Set Rules
- Use a small canonical icon set for the primary navigation:
  - `dashboard`, `onboarding`, `challenge`, `ranked`, `creator`, `help`.
- Icons always pair with visible text labels (no icon-only nav in v1 shell).
- Icon semantics must be stable across surfaces; do not reuse one glyph for unrelated actions.
