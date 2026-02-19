# Recovery Playbooks

## Sync conflict
1. Open conflict details from `/v1/saves/conflicts?profileId=<id>`.
2. Merge local/cloud snapshots manually.
3. Retry save with updated `baseVersion`.

## Ranked anti-tamper rejection
1. Recompute digest using trusted profile ID, score, and ranked salt.
2. Re-submit score to `/v1/ranked/submit`.
3. Validate anti-cheat log via `/v1/ranked/anti-cheat`.

## Network disruption
1. Continue local actions while offline.
2. Review retry queue in runtime Help panel.
3. Trigger "Retry Now" after connectivity is restored.

## Support handoff
1. Copy runtime diagnostic packet from in-app Help panel.
2. Attach packet and exact failing step.
3. Include local timestamps and command/output snippet.
