# Responsive Breakpoint Strategy (M6)

## Device classes
- `>= 1101px`: wide desktop grid (`2 + 3 + 1` column panel layout)
- `761px - 1100px`: stacked single-column panel flow with persistent command bar
- `<= 760px`: mobile-first mode with compact spacing, mobile surface switcher, hidden dense nav row

## Layout rules
- Preserve content continuity: no panel disappearance on breakpoint changes.
- Prefer single-column forms and stacked actions at mobile widths.
- Preserve minimum 44x44 tap targets for all actionable controls.
- Keep status/toast surfaces readable and non-overlapping.

## Orientation behavior
- `landscape + max-width 900px`: tighten spacing and lower panel minimum height.
- Avoid large animated layout shifts during orientation changes.

## Text scaling and zoom
- Typography scales down for narrow viewports while preserving hierarchy.
- Profile accessibility settings allow 100%-200% text scaling through runtime preferences.

## Verification
- `pnpm vitest run tests/frontend-accessibility-responsive.test.ts`
- Manual resize checks across desktop, tablet, and phone widths.
