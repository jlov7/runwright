# Showcase Release Checklist

Use this checklist before promoting the showcase on Vercel.

## Build and tests

- [ ] Run `pnpm vitest run tests/showcase-ux.test.ts tests/showcase-data-contract.test.ts`
- [ ] Run `pnpm verify`
- [ ] Confirm no uncommitted generated artifacts are introduced.

## Content and trust checks

- [ ] Persona paths still match current CLI commands and docs URLs.
- [ ] Evidence snapshot states are labeled as snapshots, not live runtime.
- [ ] Troubleshooting fix and verify commands are executable as written.
- [ ] Docs Hub links resolve to canonical repository documentation.
- [ ] Disclaimer copy is present in the footer.

## Vercel rollout checks

- [ ] Preview deployment opens and navigation anchors work.
- [ ] Mobile and desktop layouts remain usable and readable.
- [ ] Copy-command controls announce feedback via live region.
- [ ] Production alias promotion notes include timestamp of latest snapshot data.
