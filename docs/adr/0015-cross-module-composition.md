# ADR-0015: Cross-module composition — internal calls for queries, events for effects

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: owner (+ Claude Fable 5, foundation review)
- **Amended by**: ADR-0021

## Context

The conventions said "cross-module effects go through domain events, not
direct imports" — correct for effects, but silent about **synchronous
reads**. `orders.create` must synchronously resolve prices from `pricing`
and validate products from `catalog` before persisting money snapshots
(invariant §2.1-3); an asynchronous event cannot return a value. `search`
(FTS) and `analytics` need read access across many modules' tables. Left
undefined, agents will either import other modules' services directly,
duplicate pricing logic, or abuse events as RPC.

## Decision

Three sanctioned composition channels, and no others:

1. **Asynchronous effects → domain events** (unchanged). Anything that
   *changes* another module's state or triggers side effects goes through
   the transactional outbox. A module never synchronously invokes another
   module's write, except through the narrowly declared same-transaction
   atomic capability defined by ADR-0021.
2. **Synchronous reads → internal action invocation.** An action handler may
   call another module's action via the registry: `ctx.call(action, input)`.
   Constraints enforced by `packages/core`:
   - only `risk: "read"` actions are callable cross-module (`ctx.call` of a
     write action from another module is a runtime + CI contract error);
   - the callee must declare the same principal mode as the caller (a
     capability needed by staff and customers is exposed as two thin read
     actions over one module service, per ADR-0013);
   - the callee runs in the **same transaction** and the **same principal
     context; its `permissions`/target resolver are re-evaluated in that
     transaction (defense in depth);
   - customer/public nested resolvers receive the caller's verified company
     scope and must resolve the callee resource to that same company; a
     mismatch is a core invariant failure;
   - the call is recorded in the audit/log trail as a child of the caller
     (correlation + causation ids), sharing the caller's timeout budget;
   - imports go through the callee module's `index.ts` only (actions are
     already its public API) — deep imports stay an ESLint error.
3. **Declared read-model exceptions** for cross-cutting projections
   (`search`, `analytics`): a projection module may run **read-only** queries
   against another module's tables when the owning module's spec explicitly
   grants it (table list recorded in both specs). Writes remain exclusive to
   the owner.

Same-module composition stays free: actions of one module share `services/`.

## Alternatives considered

- **Direct import of another module's services** — rejected: bypasses
  permissions, audit, and timeout; invisible coupling that ESLint boundaries
  exist to prevent.
- **Events as request/response (reply events)** — rejected: async machinery
  for a synchronous need; latency, complexity, and transactional integrity
  all suffer.
- **Duplicating logic per module** (each module re-implements price
  resolution) — rejected: guarantees drift in exactly the logic (money) where
  drift is most expensive.
- **A shared "domain services" package outside modules** — rejected: becomes
  an ownerless dumping ground; capabilities must live with their owning
  module.

## Consequences

- `packages/core` implements `ctx.call` with transaction/context propagation
  and the read-only constraint; the reference slices must exercise it
  (orders → pricing is the canonical example).
- Conventions updated: "events over calls" becomes "events for effects,
  `ctx.call` for reads, read-model grants for projections".
- The contract check gains: every cross-module `ctx.call` target is
  `risk: "read"` and principal-compatible; every read-model table grant is
  declared in the owning spec.
- Module specs must list: events consumed, actions called via `ctx.call`,
  and read-model grants — making the dependency graph reviewable.
