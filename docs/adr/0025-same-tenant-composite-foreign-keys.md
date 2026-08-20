# ADR-0025: Same-tenant composite foreign keys

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: owner (+ Cursor Grok 4.6)

## Context

Every tenant table carries `company_id` and a single-column FK to the
parent's `id`. Postgres then accepts a child of company A that points at a
parent UUID owned by company B. The first golden backend slice (SHO-85)
would have cloned that hole into every later module.

ADR-0009 rejected **RLS** as a second authorization source. That does not
decide **referential integrity** of intra-tenant pointers. Authorization
(who may act) stays in action code; the database may still refuse an
impossible row.

## Decision

Intra-tenant foreign keys are composite: `(company_id, parent_id)
REFERENCES parent (company_id, id)`. Every tenant table (a domain table
with `company_id`) declares `UNIQUE (company_id, id)` as that FK target.
The primary key remains `id`. `company_id → companies.id` stays a
single-column FK. The tenant root `companies` has no `company_id`.

Authorization is unchanged (ADR-0009): handlers load the parent under the
verified `companyId` and return `NotFoundError`. A composite-FK violation
is a server bug (`CoreInvariantError`), not a client-facing error.

PostgreSQL 15 `ON DELETE SET NULL (column)` is required when a composite
FK includes `NOT NULL company_id` plus a nullable parent id. Drizzle
cannot emit that clause; a custom migration (db.md §7) scopes SET NULL to
the nullable column so a parent delete cannot null `company_id`.

## Alternatives considered

- **Application checks only** — rejected as the golden template. Agents
  forget `AND company_id = ?` on writes and joins; a persisted cross-tenant
  pointer is sticky.
- **RLS as defense in depth** — already rejected by ADR-0009.
- **Composite primary keys `(company_id, id)`** — rejected until a
  sharding story exists; UUID PKs stay.
- **Defer to write-action tickets** — rejected. This is schema integrity
  and the copy template for later modules.

## Consequences

- Schema tests prove `23503` on a cross-tenant parent pointer and keep the
  card-named SET NULL / CASCADE behavior.
- New tenant tables add `UNIQUE (company_id, id)` from the start.
  `company_members` is updated in the same slice so the foundation golden
  matches.
- Does not replace scoped queries, inherited isolation suites, or
  `NotFoundError`.
