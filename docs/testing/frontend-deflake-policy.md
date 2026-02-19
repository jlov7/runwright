# Frontend E2E Deflake Policy

## Purpose
Keep frontend journey tests stable by isolating real regressions from transient timing noise.

## Quarantine process
1. Tag flaky cases in issue tracking with `frontend-flake` and exact failing assertion.
2. Keep flaky tests in suite, but add deterministic wait/control fixes before any retry-loop workaround.
3. Require one root-cause commit and one verification commit before removing `frontend-flake` tag.

## Stability controls
- Use deterministic runtime seeds/salts in tests.
- Avoid relying on implicit race ordering; use explicit awaits and stable transitions.
- Keep anti-cheat/rate-limit tests aware of cooldown windows.

## Exit criteria
- Test passes 20 consecutive local runs and 10 CI runs before being declared deflaked.
- Any recurring flake reopens the issue and blocks milestone signoff.
