# Showzy 2.0 — Agent Instructions

Showzy is a business operating platform for small businesses in Ukraine —
company profile with a product catalog (5-level dynamic pricing), public and
authenticated consumer discovery with bounded social engagement, chat-centric
order flow, B2B
document workflow with QES signing (client-side crypto, keys never leave the
device), and integrations (Monobank, Nova Poshta). This repository is a
**ground-up rewrite** of Showzy v1 with an AI-first interface: a classic UI
and an AI chat that execute the exact same actions.

## Required reading (in this order)

1. `docs/blueprint.md` — architecture, stack, action registry, foundation
   invariants, SDD pipeline. This is the constitution of the project.
2. `docs/scope.md` — what we build in V2 launch, what we defer, what we drop,
   and the mobile-first roadmap.
3. `docs/adr/` — accepted architecture decisions and why alternatives were
   rejected. Never contradict an accepted ADR; deviations require a new ADR
   first.
4. `docs/pipeline.md` — how the agent pipeline runs: stages, roles, models,
   commands, exit criteria.
5. `docs/specs/<module>.md` — the spec of the module you are working on.
   A spec is a contract: as an implementer you may not change it, only send
   it back for rework.

## Non-negotiable invariants (blueprint §2.1)

1. **Tenant isolation.** Tenant scope comes from a verified action context
   (staff membership, typed customer/public target resolver, explicit
   system scope, or null company for `consumer` and declared public global
   discovery projections — ADR-0013, ADR-0018, ADR-0020), never from an input
   identifier as an access grant.
   Cross-tenant access must be impossible and is verified by tests every
   module inherits.
2. **Idempotency.** Orders, payments, document generation, webhooks, and
   AI-invoked actions are safely retryable.
3. **Money snapshots.** Order items store immutable price/discount/tax
   snapshots captured at creation time. Never recompute old orders from
   current pricing.
4. **Observability / audit.** Authorized tenant actions carry `request_id`,
   accountable `actor_id` (user/system), invocation `channel`,
   `company_id`, and `action`; global system work has null company and public
   reads use log-only actor `anonymous` (never audit/events).
5. **Projections never own domain state.** Chat is the primary interaction
   surface for orders, but the order domain is the source of truth. A chat
   message stores `orderId`, never order status. `orders` emits events
   (`orders.confirmed`); `chat` subscribes and materializes cards.

## Core rules

- **One data path.** All business logic goes through `defineAction`. Clients
  never touch the DB directly. Authorization lives in action `permissions`.
- **TypeScript strict end-to-end.** No `any`, no `as unknown as`.
- Modules (`packages/modules/*`) export only actions and events. No direct
  cross-module imports (enforced by ESLint boundaries). Cross-module writes
  are asynchronous events unless ADR-0021 explicitly declares a
  same-transaction atomic capability.
- Explicit code, no magic: no decorators with hidden behavior, no DI
  containers.
- All code, comments, and documentation are in **English**.

See `.cursor/rules/` for detailed conventions, prohibitions, and the
definition of done.

## Legacy reference (Showzy v1)

The previous implementation lives in a separate repository (locally at
`E:\showzy`). **Never modify it.** Use it as read-only reference for business
logic, edge cases, and data shapes. Curated extracts are available in this
repo so you usually don't need v1 at all:

- `docs/reference/v1-backend-audit.md` — full audit of the v1 backend and DB
  (modules, endpoints, infrastructure, migration decisions).
- `docs/reference/v1-database.types.ts` — generated types of the v1 Postgres
  schema (note: has minor drift vs. migrations; treat migrations as truth).
- `docs/reference/v1-migrations/` — all 83 v1 SQL migrations (the authoritative
  record of the v1 schema, triggers, RPC functions, and RLS policies).

The v1 schema is a reference, **not** a template: v2 replaces RLS with
code-level permissions, replaces DB RPC with Drizzle queries in action
handlers, and makes deliberate per-trigger decisions about what moves into
application code (blueprint §6).
