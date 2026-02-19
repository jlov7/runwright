# Frontend Visual Regression Baselines

## Baseline source
- Fixture: `tests/fixtures/frontend-visual-baseline.json`
- Capture script: `scripts/capture_frontend_visual_baseline.ts`
- Regression test: `tests/frontend-visual-regression.test.ts`

## Commands
- Refresh baseline: `pnpm visual:baseline:capture`
- Validate baseline: `pnpm test:visual`

## Policy
- Any shell visual change must include an intentional baseline update in the same PR.
- CI runs `pnpm test:visual` to block unintended visual drift.
