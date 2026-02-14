# Open Questions

## Q1: v1 distribution channel
- Question: Is v1 release expected as npm package publication, GitHub release artifacts only, or both?
- Why it matters: README deploy/release notes and final release steps depend on the target channel.
- Current assumption: Support both local verification and GitHub release artifact workflow; do not assume npm publish automation.
- Status: Open

## Q2: Required signing mode for v1 release
- Question: Should v1 require signature verification (`--require-signature`) in release policy, and if yes, which key mode (HMAC vs ed25519)?
- Why it matters: Determines required env vars and release runbook defaults.
- Current assumption: Keep both modes documented, recommend ed25519 for production releases.
- Status: Open

## Q3: CI status confirmation source of truth
- Question: Should release sign-off require explicit verification of current GitHub Actions run status, or is local `pnpm verify` + `pnpm ship:gate` sufficient for v1 sign-off?
- Why it matters: `RELEASE_CHECKLIST.md` includes a CI-green requirement that is not directly verifiable offline.
- Current assumption: Treat remote GitHub required checks as final sign-off gate outside this local session.
- Status: Open
