# ADR-0005: Drizzle ORM + drizzle-kit

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The DB schema must be a source of TypeScript types (replacing Supabase
typegen) and migrations must be versioned and reviewable. Agents write most
queries, so the query API must be explicit and close to SQL.

## Decision

Drizzle ORM with schema defined in TypeScript (`packages/db`), migrations
generated and versioned by drizzle-kit. Each table is owned by exactly one
module.

## Alternatives considered

- **Prisma** — rejected: separate schema DSL, a generate step, and a
  query-engine layer of magic between agent code and SQL.
- **Kysely / raw SQL** — rejected: type-safe but schema types would need a
  separate introspection step; Drizzle gives schema-as-types directly.

## Consequences

- Schema changes are ordinary TypeScript PRs; types propagate through the
  contract to clients automatically.
- Business logic that lived in v1 DB triggers/RPC moves into action handlers
  (deliberate per-trigger decisions — blueprint §6).
