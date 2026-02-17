# Game Runtime Help

Use this guide for the web runtime shell shipped in `apps/web`.

## Start the runtime

```bash
pnpm game:runtime
```

This starts an HTTP server that:
- serves the web shell at `/`
- exposes runtime APIs under `/v1/*`
- persists gameplay state to `.skillbase/runtime-state.json`

## Core journey in the web shell
1. Create profile.
2. Run tutorial hint.
3. Save progress.
4. Publish level to hit first-success.

The status panel reflects onboarding completion after each action.

## Failure states to verify
- Ranked anti-tamper rejection:
  - Run **Submit Ranked Score** before integrating digest signing.
  - Expected: inline error and no leaderboard acceptance.
- Save conflict path:
  - Send `POST /v1/saves` with stale `baseVersion` and `strategy: manual-merge`.
  - Expected: `409` with `sync-conflict` and explicit merge guidance.

## Helpful endpoints
- `GET /v1/help` for tooltip/help copy.
- `GET /v1/release/readiness` for 35-item readiness matrix.
- `GET /v1/network/policy` for offline/degraded behavior contract.

## Runtime env var
- `RUNWRIGHT_RANKED_SALT` (optional for local, required in shared environments): server-side anti-tamper salt used by ranked digest verification.
