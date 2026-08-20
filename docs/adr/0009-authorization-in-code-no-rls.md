# ADR-0009: Authorization in code, no RLS

- **Status**: Accepted
- **Date**: 2026-08-16
- **See also**: ADR-0025 (same-tenant composite FKs are referential
  integrity, not RLS)

## Context

v1 has ~240 RLS policies across ~81 tables because clients query Postgres
directly. In v2 there is one data path: clients → API → actions → Drizzle
(ADR-0002, ADR-0008). Duplicating authorization in both code and DB policies
would give agents two places to keep in sync.

## Decision

Authorization lives exclusively in `defineAction.permissions`, evaluated in
the action context. The v1 permission model (`role_permission_defaults` +
per-member overrides, `has_company_permission`) carries over conceptually
1:1. Tenant isolation is enforced by the action context (`ctx.companyId`
from the authenticated membership) and verified by a mandatory cross-tenant
test suite inherited by every module.

## Alternatives considered

- **Keep RLS as defense-in-depth alongside code checks** — rejected for now:
  two authorization sources drift, and RLS assumes per-user DB sessions that
  a pooled API doesn't have. May be revisited post-MVP for a thin
  tenant-scoping layer if warranted.

## Consequences

- The single biggest v1 artifact (~240 policies) is deleted, replaced by
  code + tests.
- The DB no longer enforces **authorization** (who may act) — which is
  exactly why the cross-tenant test suite is a phase-0 foundation
  invariant, not optional. Same-tenant pointer integrity is ADR-0025, not
  a return of RLS.
