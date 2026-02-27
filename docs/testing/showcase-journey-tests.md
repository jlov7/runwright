# Showcase Journey Test Suite

This document defines the minimum verification path for `apps/showcase`.

## Core contract tests

```bash
pnpm vitest run tests/showcase-ux.test.ts tests/showcase-data-contract.test.ts
```

Validates:
- Required UX lanes and DOM anchors.
- Required interactivity wiring (`app.js`).
- Artifact-backed data contracts for persona, evidence, and troubleshooting lanes.

## Full quality check

```bash
pnpm verify
```

Use full verification before release tags, preview promotions, or public demos.

## Manual smoke checks

1. Open `apps/showcase/index.html` in a browser.
2. Persona switcher updates journey card content and command copy controls.
3. Evidence switcher updates status badges, stage cards, and provenance copy.
4. Troubleshooting cards show fix and verify commands with docs links.
5. Reduced motion preference disables transitions.
6. Mobile layout remains readable at widths <= 980px.
