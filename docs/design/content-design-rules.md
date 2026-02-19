# Frontend Content Design Rules (M3)

## Purpose
Standardize how every primary surface communicates title, intent, status, and next action.

## Canonical Page Hierarchy Pattern
1. Title: clear noun phrase for the current surface.
2. Intent: one sentence describing why this surface exists.
3. Status: explicit current state (`ready`, `needs action`, `blocked`).
4. Primary CTA: one visible next action.

## Label Rules
- Use user language, not implementation jargon.
- Keep labels under six words where possible.
- Prefer action-first verbs for buttons.

## Helper Text Rules
- Include helper text when the action has side effects.
- Keep helper text to one sentence.
- Do not duplicate label text in helper text.

## Empty State Rules
- Empty states must include:
  - Why the surface is empty.
  - The fastest next action.
  - A fallback help path.
- Empty-state CTA text must match the destination action label.

## Status Copy Rules
- Success: confirm outcome and next opportunity.
- Warning: explain risk and recommended mitigation.
- Error: explain failure reason and exact recovery step.

## Command/Search Affordance Rules
- Provide one global jump field for key surfaces.
- Accept canonical names (`dashboard`, `profile`, `onboarding`, `challenge`, `help`).
- Invalid search input must return a correction hint, not a silent failure.
