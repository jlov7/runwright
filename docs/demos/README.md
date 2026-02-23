# Guided Product Demos (Showboat + Rodney)

This repository supports reproducible, visual product walkthroughs using [Showboat](https://github.com/simonw/showboat) and [Rodney](https://github.com/simonw/rodney).

## Why this exists

- Share first-run UX and recovery flows with reviewers.
- Keep demo evidence reproducible, not ad-hoc.
- Keep README concise while linking to richer walkthrough artifacts.

## Prerequisites

- `showboat` installed and on `PATH`
- `rodney` installed and on `PATH`
- `pnpm install` completed

## Generate a demo

```bash
pnpm demo:showboat
```

Default outputs:

- Markdown demo: `docs/demos/runwright-web-runtime-demo.md`
- Screenshots: `docs/demos/assets/`
- Runtime log: `reports/demos/runtime.log`

## Reuse an existing runtime server

If the runtime is already running, skip server startup:

```bash
START_SERVER=0 RUNTIME_URL=http://127.0.0.1:4242 pnpm demo:showboat
```
