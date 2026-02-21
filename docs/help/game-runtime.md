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
1. Choose a persona in the first-run guide overlay and start guided setup.
2. Create profile.
3. Run tutorial hint.
4. Save progress.
5. Publish level to hit first-success.

The guided journey strip reflects onboarding completion after each action.

## UX structure (progressive disclosure)
- Header nav is intentionally core-only: `Dashboard`, `Profile`, `Onboarding`, `Help`.
- Use **Explore Advanced Surfaces** to open challenge/campaign/coop/ranked/creator/moderation/liveops/analytics workflows.
- Use **Take Me To Next Step** to jump directly to the next unfinished onboarding task.
- Help panel is intentionally collapsible to reduce first-run noise.

## Keyboard shortcuts
- `/` opens Explore and focuses surface search.
- `?` opens the help panel.
- `Esc` closes the guide overlay or Explore panel.

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
