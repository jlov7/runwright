# Staged Rollout And Rollback Runbook

## Purpose
Reduce launch risk with progressive exposure and fast rollback.

## Rollout Stages
1. `1%` internal canary: verify login, onboarding, ranked, save/sync, moderation.
2. `10%` regional slice: monitor crash rate, sync conflicts, anti-cheat rejects.
3. `25%` mixed cohorts: validate retention funnel and creator moderation SLA.
4. `50%` broad rollout: watch p95 latency and failed command ratios.
5. `100%` global release: hold 24h elevated monitoring window.

## Entry Gates Per Stage
- `pnpm verify`
- `pnpm run doctor`
- `pnpm quality:evidence:verify`
- `pnpm ship:gate`
- No open P0 incidents.

## Rollback Triggers
- Crash-free sessions below SLO.
- Ranked integrity or anti-cheat false-positive spike.
- Save/sync conflict rate above threshold.
- Critical onboarding path regression.

## Rollback Procedure
1. Set LiveOps kill-switch.
2. Repoint to prior stable artifact.
3. Re-run smoke checks (onboarding, ranked, save, moderation).
4. Open incident and document timeline.
5. Resume staged rollout only after root-cause fix and green gates.
