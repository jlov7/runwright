# Frontend IA Persona Walkthrough Scripts (M3)

## Purpose
Provide five repeatable persona walkthroughs to validate navigation clarity and task discoverability.

## Persona 1: New Player (Non-technical)
- Goal: Reach first success without command-line knowledge.
- Script:
  - Open dashboard.
  - Create profile from primary CTA.
  - Switch to onboarding surface and complete checklist.
  - Publish first level from onboarding flow.
- Pass criteria:
  - Can identify next action in under 10 seconds at each step.
  - No dead ends; help link is visible when blocked.

## Persona 2: Competitive Player
- Goal: Submit ranked score and confirm integrity state.
- Script:
  - Jump to ranked from nav or search.
  - Submit score.
  - Read ranked status/result message.
- Pass criteria:
  - Ranked path discoverable in one click.
  - Success/error outcome includes explicit next action.

## Persona 3: Creator
- Goal: Move from profile setup to challenge publishing context.
- Script:
  - Open profile surface and verify account readiness.
  - Navigate to challenge surface.
  - Trigger challenge generation or empty-state CTA.
- Pass criteria:
  - Breadcrumb and page title remain consistent after navigation.
  - Empty state explains what prerequisite is missing.

## Persona 4: QA/Operator
- Goal: Validate each core surface can be reached and interpreted quickly.
- Script:
  - Visit dashboard, profile, onboarding, challenge.
  - Confirm status indicator and primary CTA exist on each surface.
- Pass criteria:
  - Every surface has title/intent/status/CTA hierarchy.
  - Surface transitions update active nav and breadcrumb correctly.

## Persona 5: Returning Player
- Goal: Resume progress after partial setup.
- Script:
  - Open dashboard with existing profile.
  - Review success criteria indicators.
  - Continue from suggested next action.
- Pass criteria:
  - Dashboard distinguishes incomplete vs complete onboarding.
  - Suggested next action aligns with stored progress state.
