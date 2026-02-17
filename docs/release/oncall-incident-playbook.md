# On-call Incident Playbook

## Severity Levels
- `P0`: launch-blocking outage, data-loss risk, or integrity compromise.
- `P1`: major degradation in core journey completion or release gates.
- `P2`: limited scope regressions with workarounds.

## Immediate Triage
1. Confirm impact on onboarding/core loop/ranked/save.
2. Assign incident commander and comms owner.
3. Capture failing command, time window, and affected cohort.
4. Apply containment (feature kill-switch or rollback) when needed.

## Investigation Checklist
- Check `reports/quality/ship-gate.summary.json` and `reports/doctor/doctor.json`.
- Inspect recent moderation, telemetry, anti-cheat, and crash envelopes.
- Correlate to latest deploy, content rotation, or config change.

## Resolution And Follow-up
1. Patch and verify with full gates.
2. Publish incident summary and customer-facing status update.
3. Add regression tests and update runbooks.
4. Track action items to completion before next rollout stage.
