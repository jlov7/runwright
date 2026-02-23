# Runtime SLO Policy (v1)

## Objective
Keep runtime API responsiveness and reliability within a predictable launch envelope for first-run and core-loop journeys.

## SLO Targets
- Global runtime request latency `p95 <= 350ms` during local quality checks.
- Minimum sampled request volume per check run: `>= 8` requests.
- Required endpoint coverage in sampled traffic:
  - `GET /v1/health`
  - `POST /v1/auth/signup`

## Enforcement Command
- `pnpm runtime:slo:check`

This command writes `reports/quality/runtime-slo.report.json` and exits nonzero when any SLO check fails.

## Notes
- This SLO gate is a deterministic local launch-readiness guard, not a production load-test substitute.
- Production operations should pair this gate with staged rollout monitoring and incident response playbooks.
