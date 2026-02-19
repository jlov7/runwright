# Frontend Boundary Rules

## Layer Contract
- `app`: composition root; may import from `features`, `entities`, `shared`.
- `features`: workflow logic; may import from `entities`, `shared`; must not import from `app`.
- `entities`: domain models/adapters; may import from `shared`; must not import from `app` or `features`.
- `shared`: reusable utilities/primitives; must not import from `app`, `features`, or `entities`.

## Allowed Dependencies
- `app -> features/entities/shared`
- `features -> entities/shared`
- `entities -> shared`
- `shared -> (no upward imports)`

## Prohibited Patterns
- Cross-feature deep imports bypassing entity/shared contracts.
- Shared layer importing workflow code.
- App layer holding domain business rules.

## Enforcement
- ESLint `no-restricted-imports` boundaries for `apps/web/src/**`.
- PR review requires boundary compliance for all new modules.
