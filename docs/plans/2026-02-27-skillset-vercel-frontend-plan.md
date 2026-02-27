# SkillSet Vercel Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a world-class, read-only Vercel frontend for SkillSet by Runwright that makes the platform immediately understandable to internal and external users through clear onboarding, guided journeys, evidence-first reporting, and robust troubleshooting.

**Architecture:** Keep Runwright CLI as the source of truth and position the Vercel app as a thin presentation layer over generated artifacts and canonical docs. Build static-first pages in `apps/showcase` that consume stable JSON artifacts (pipeline outputs, scan summaries, release evidence) and route users to actionable next steps (`journey`, `pipeline run`, `help`) without duplicating backend orchestration logic.

**Tech Stack:** Static frontend (`apps/showcase`: HTML/CSS/JS), Vercel static deployment, Vitest + Playwright for deterministic UX checks where applicable.

---

## Product Scope (v1)

### In scope
- Public-ready homepage that explains product value and trust model.
- Guided onboarding lane for three personas:
  - Builder (engineer)
  - Reviewer (manager/compliance)
  - Operator (release/platform)
- Read-only evidence lane that visualizes:
  - pipeline stage status (update/scan/apply)
  - evaluation gate/score
  - release integrity signals
- “How to run” lane with copy-paste-safe command sequences.
- Troubleshooting lane with symptom -> fix mapping.
- Links to canonical docs (`api-reference`, `help`, `security`, `contributing`).

### Out of scope (v1)
- Triggering CLI runs from the web UI.
- Editing manifests/policies from browser.
- Multi-user auth/session features.
- Backend rewrite or duplicated execution engine.

---

## UX Quality Bar (non-negotiable)

### Information architecture
- Primary nav: `Product`, `Get Started`, `Evidence`, `Troubleshooting`, `Docs`.
- Every page has one primary CTA and one secondary CTA.
- No dead ends: every empty/error state includes a specific next command.

### Onboarding/journey quality
- Role-specific paths with “time to first success” expectations.
- Progressive disclosure: novice-safe first, advanced details on demand.
- Context strip on each page: “Where am I / what next / why this matters”.

### Accessibility and readability
- Semantic landmarks, keyboard navigability, visible focus states.
- Sufficient color contrast and reduced-motion support.
- Mobile-first responsive layout with no content loss.

### Trust and evidence
- Show provenance (where metrics came from and when generated).
- Distinguish “live runtime” vs “artifact snapshot”.
- Never imply pipeline success without explicit evidence state.

---

## Delivery Tracks

### Track A: IA + content model
1. Define final page map and route structure in `apps/showcase`.
2. Define page-by-page message hierarchy (headline, proof, CTA).
3. Normalize terminology: “SkillSet by Runwright” (platform) vs `runwright` (CLI).

### Track B: Visual system
1. Define tokenized color/spacing/type scales in `apps/showcase/styles.css`.
2. Build reusable section patterns (hero, proof cards, timeline, command blocks, alerts).
3. Add polished but restrained motion (load-in, section transitions, no distracting effects).

### Track C: Guided onboarding lanes
1. Add role selector with clear outcomes.
2. Build three guided paths with branching quickstart snippets.
3. Add “Next command” sticky module linked to docs/help.

### Track D: Evidence dashboard (read-only)
1. Define JSON contract for display payloads (pipeline/eval/release).
2. Render stage timeline + gate status + score explanation.
3. Add “what changed?” diff callouts for baseline vs current snapshots.

### Track E: Troubleshooting and docs hub
1. Build symptom-indexed troubleshooting cards.
2. Add command recipes and common failure recoveries.
3. Link directly to canonical deep docs (API, schema, security, contributing).

### Track F: Quality gates and launch
1. Add deterministic UI acceptance checks (render, nav, mobile).
2. Add copy consistency checks for critical phrases/CTAs.
3. Add deployment checklist and rollback instructions for Vercel.

---

## TDD/Verification Plan

### Required tests
- Route/navigation integrity tests.
- Persona onboarding journey tests.
- Evidence card rendering tests for pass/warn/blocked.
- Troubleshooting mapping tests (symptom -> command).
- Visual sanity snapshots for desktop and mobile.

### Required commands before release
```bash
pnpm verify
pnpm --dir apps/showcase build
pnpm --dir apps/showcase test
# If Playwright checks are added for showcase:
pnpm --dir apps/showcase test:e2e
```

### Acceptance criteria
- A new user can identify what the system does within 30 seconds.
- Each persona can reach a clear “first success” path in <= 3 clicks.
- Evidence lane clearly communicates current status and trust posture.
- Troubleshooting lane resolves top 5 failure modes with explicit commands.
- No critical accessibility violations in automated checks.

---

## File Plan (expected)

- Modify:
  - `apps/showcase/index.html`
  - `apps/showcase/styles.css`
  - `apps/showcase/vercel.json` (if needed)
  - `README.md` (showcase positioning links)
  - `docs/help/README.md` (showcase lane links)
- Create:
  - `apps/showcase/app.js` (if JS interactivity is required)
  - `apps/showcase/data/*.json` (artifact-fed demo/evidence payloads)
  - `docs/release/showcase-release-checklist.md`
  - `docs/testing/showcase-journey-tests.md`

---

## Risks and controls

- Risk: turning showcase into a second product surface with divergent logic.
  - Control: strict read-only boundary and CLI-source-of-truth policy.
- Risk: over-designed UI with unclear actionability.
  - Control: enforce one primary CTA per page and task-based user tests.
- Risk: stale evidence confusing stakeholders.
  - Control: explicit snapshot timestamps and stale-state labels.

---

## Rollout

1. Internal preview on Vercel preview deployment.
2. Stakeholder walkthrough (builder, reviewer, operator personas).
3. Fix high-severity usability findings.
4. Promote to production alias.
5. Add release note with known limitations and roadmap.
