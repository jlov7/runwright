# Non-Technical Onboarding Guide

## What Skillbase is (plain language)
Skillbase is a safety and consistency layer for AI coding skills.
It ensures the right skills are installed, scanned, and verified the same way for every user and environment.

## What value you should expect
- Faster onboarding for new teammates
- Fewer "works on my machine" setup issues
- Better confidence that risky instructions are flagged before use
- Audit-friendly release artifacts for compliance/review

## The user journey in business terms
1. **Define standard skills**: Team decides what skills should be available.
2. **Validate safety**: Scan checks identify risky instructions.
3. **Apply consistently**: Everyone gets the same configured skill set.
4. **Share safely**: Signed, verifiable bundles can be distributed.

## What “good” looks like
- New engineer reaches first successful apply in less than 10 minutes.
- No unresolved high-risk scan findings in release path.
- Re-running setup produces identical results.
- Release artifacts are verifiable with checksums/signatures.

## What to ask your technical lead to show
- `scan --format json` output with clear pass/fail decisions
- lockfile generation and frozen checks
- bundle export + verification
- CI scorecard and evidence verification artifacts

## Governance and accountability
- Ownership: `.github/CODEOWNERS`
- Support process: `.github/SUPPORT.md`
- Security policy: `SECURITY.md`
- Release integrity policy: `docs/policies/release-signing-runbook.md`
