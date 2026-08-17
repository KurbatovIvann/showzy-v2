# Architecture Decision Records

Every significant architectural decision is recorded here. The blueprint
(`docs/blueprint.md`) describes the *current* target architecture; ADRs record
*why* it looks that way and what alternatives were rejected — so agents (and
humans) don't relitigate settled questions or silently deviate.

## Rules

- **Agents must not contradict an accepted ADR.** If an implementation task
  seems to require deviating from one, stop and report — a new ADR
  (superseding the old one) must be accepted first.
- New ADRs are proposed via PR using `template.md`, numbered sequentially.
- Status lifecycle: `Proposed` → `Accepted` → (`Superseded by ADR-XXXX` | `Deprecated`).

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-full-typescript-stack-on-node.md) | Full TypeScript stack on Node.js (Go rejected) | Accepted |
| [0002](0002-decompose-supabase.md) | Decompose Supabase into self-hosted components | Accepted |
| [0003](0003-hono-http-framework.md) | Hono as the HTTP framework | Accepted |
| [0004](0004-orpc-api-contract.md) | oRPC for the API contract | Accepted |
| [0005](0005-drizzle-orm.md) | Drizzle ORM + drizzle-kit | Accepted |
| [0006](0006-better-auth.md) | better-auth for authentication | Accepted |
| [0007](0007-bullmq-redis.md) | BullMQ + Redis for queues (pg-boss rejected) | Accepted |
| [0008](0008-action-registry.md) | Action registry as the single source of truth | Accepted |
| [0009](0009-authorization-in-code-no-rls.md) | Authorization in code, no RLS | Accepted |
| [0010](0010-mobile-first-client-strategy.md) | Mobile-first client strategy | Accepted |
| [0011](0011-chat-is-a-projection.md) | Chat is a projection; the order domain owns state | Accepted |
| [0012](0012-carry-over-outbox-and-qes-core.md) | Carry over the outbox pattern and the QES crypto core | Accepted |
| [0013](0013-principal-model-and-action-context.md) | Principal model — staff, customer, public, system | Accepted |
| [0014](0014-drizzle-schema-placement.md) | Drizzle schema lives in packages/db, one file per owning module | Accepted |
| [0015](0015-cross-module-composition.md) | Cross-module composition — internal calls for queries, events for effects | Accepted |
| [0016](0016-client-safe-action-descriptors.md) | Client-safe action descriptors and server implementations | Accepted |
| [0017](0017-design-system-first-dual-flow-ux.md) | Design-system-first, mobile-first, dual-flow UX | Accepted |
