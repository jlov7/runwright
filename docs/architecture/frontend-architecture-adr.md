# ADR: Frontend Architecture Modernization for 100/100 Program

## Status
Accepted (M0)

## Context
The current frontend is a single static shell (`apps/web/index.html` + inline script). It supports MVP journeys but constrains scalability, maintainability, and testability for world-class targets.

## Decision
Adopt a typed modular frontend architecture under `apps/web` with explicit layers:
- `app`: bootstrap, routing shell, global providers.
- `features`: user-facing workflows grouped by domain.
- `entities`: domain models and adapters.
- `shared`: reusable UI primitives, API client, utilities.

Core standards:
1. All frontend business logic uses TypeScript.
2. Runtime communication goes through a typed API client boundary.
3. UI state and server state boundaries are explicit.
4. Navigation shell is persistent and route-aware.

## Consequences
Positive:
- Better maintainability, testability, and separation of concerns.
- Easier scaling from MVP shell to multi-surface app.
- Clear architecture guardrails for contributors.

Negative:
- Initial migration cost from inline script to structured modules.
- Temporary dual-surface complexity during transition.

## Implementation Notes
- Start by introducing `apps/web/tsconfig.json` and a typed API client.
- Incrementally move inline behaviors into modules while preserving runtime API compatibility.
- Add lint/typecheck hooks for frontend modules in milestone gates.
