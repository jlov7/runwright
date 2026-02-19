# Frontend Accessibility Baseline Audit (M6)

Date: 2026-02-19

## Scope
- Runtime web shell in `/apps/web/index.html` and `/apps/web/styles.css`
- Primary journeys: onboarding, first success, recovery, help

## Automated checks
- `pnpm vitest run tests/frontend-accessibility-responsive.test.ts`
- Assertions cover skip links, landmarks, explicit labels, live regions, reduced motion, tap targets, and responsive breakpoints.

## Manual keyboard audit
- `Tab` order reaches skip link, global nav, command bar, primary CTA, and form controls.
- `/` shortcut moves focus to command bar.
- Route/surface change sends focus to `#surface-title` for deterministic context updates.

## Screen-reader and announcement audit
- Live regions present for command feedback and status updates.
- Global errors announced via `role="alert"` in `#global-error-boundary`.
- Recovery queue and diagnostics are navigable using semantic headings and labeled controls.

## Contrast and motion
- Focus ring token remains visible in dark/light themes.
- Reduced-motion support is enforced via `prefers-reduced-motion` and `.reduced-motion` mode.

## Remaining risk
- Full screen-reader voiceover pass on native mobile browsers should still be executed before external beta.
