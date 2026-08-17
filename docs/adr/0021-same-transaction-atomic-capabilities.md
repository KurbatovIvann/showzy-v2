# ADR-0021: Same-transaction atomic cross-module capabilities

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: Human owner
- **Amends**: ADR-0015

## Context

ADR-0015 intentionally limits synchronous cross-module calls to reads and
routes effects through domain events. That remains correct for effects that
can happen after the caller commits.

Two launch invariants require a stronger all-or-nothing boundary:

1. `orders.confirm` must atomically revalidate and decrement catalog-owned
   stock. Pending orders do not reserve stock, and concurrent confirmations
   must not oversell.
2. Customer checkout must atomically ensure its company CRM record and create
   the order. A committed order may not reference a missing customer, and a
   rolled-back order may not leave an orphan CRM record.

An event cannot reject the already-committed caller. Letting orders query
catalog/customer tables directly would violate ADR-0014 ownership. Moving
stock into orders would invert the same problem for catalog administration.

Catalog currently models integer stock while orders use fixed-scale
`quantity_milli`. It also models `allow_backorders`, while the owner decision
for launch is to block quantities above available stock.

## Decision

### Composition channels

ADR-0015 now defines four sanctioned channels:

1. domain events for asynchronous cross-module effects;
2. read-only `ctx.call` for synchronous queries;
3. read-model grants for approved projection modules;
4. **`ctx.callAtomic` for rare, explicitly declared cross-module writes that
   must commit or roll back with the root action**.

`ctx.callAtomic` is not a general nested write API. All constraints below are
enforced by contract checks and at runtime:

- caller and callee contracts declare the edge (`atomicCalls` and
  `atomicCallers`);
- the callee is `transport: "internal"`, `risk: "write"`, has no confirmation,
  and is never exposed as a client or AI tool;
- caller and callee use the same principal mode and verified company scope;
  separate thin capabilities are required for different principals;
- the root action must be idempotent;
- the callee receives the root physical Drizzle transaction and a writable
  transaction facade, but may access only its owning schema;
- the callee cannot commit, roll back, open another transaction, call another
  atomic capability, or escape/retain the transaction;
- one atomic-call edge is allowed below the root; ordinary read calls remain
  depth-limited and cycle-checked;
- input/output validation, permissions/target resolution, timeout accounting,
  logs/spans, audit, and emitted events still run for the callee;
- child audit/events commit only with the root transaction;
- an undeclared edge, tenant mismatch, principal mismatch, nested atomic call,
  timeout overflow, or call cycle is a `CoreInvariantError`.

The root owns rate limiting, confirmation, idempotency reservation/finalization,
and transaction lifecycle. Atomic callees do not create independent
idempotency reservations.

### Stock ownership and units

`catalog` remains the authoritative stock owner. Product and variant stock use
fixed-scale integer fields:

- `stock_quantity_milli bigint`;
- `low_stock_threshold_milli bigint`;
- `track_inventory boolean`.

Launch does not support backorders; `allow_backorders` is removed. Quantities
use the same scale as `orders.quantity_milli`.

When an order line selects a variant, only that variant balance is
authoritative and decremented. A line without a variant decrements the product
balance. Product and variant balances are never decremented together for one
line.

Checkout performs a read-only availability check. This is user feedback, not
a reservation or guarantee. Stock remains unchanged while the order is
pending.

`orders.confirm` invokes a catalog-owned atomic capability in its transaction:

1. lock affected catalog rows in stable product/variant ID order;
2. verify company, active state, tracking mode, and requested quantities;
3. decrement tracked balances with a non-negative condition;
4. emit catalog stock-adjusted events;
5. return resulting balances.

Insufficient stock raises `ConflictError`; order transition, stock changes,
audit, idempotency finalization, and outbox events all roll back.

The order row is locked before the atomic call. Only the transition from the
pending state invokes decrement, so duplicate confirmations cannot decrement
twice. Any launch transition that restores confirmed stock must use a paired
catalog atomic capability in the same transaction.

### CRM checkout composition

Checkout uses the same channel through a customer-principal internal
`customers.ensureMyCrmRecord` capability. It derives the company from the
verified customer target and owns all CRM-table access. The current
system-principal write called through read-only `ctx.call` is replaced during
spec rework.

## Alternatives considered

- **Decrement through `orders.confirmed` event** — rejected: confirmation
  commits before stock mutation and concurrent orders can oversell.
- **Let orders write catalog tables** — rejected: bypasses aggregate
  ownership, authorization, audit, and catalog events.
- **Move stock to orders** — rejected: catalog creation/administration would
  require the same cross-module write in the opposite direction.
- **Add an inventory module now** — rejected: it does not remove the atomic
  composition need and adds a module without multi-warehouse/ledger scope.
- **Use a database trigger/function** — rejected: hides policy outside
  Drizzle/actions and crosses module ownership.
- **Permit all write actions through `ctx.call`** — rejected: creates
  unrestricted nested transactions, ambiguous idempotency, and call cycles.
- **Reserve stock at checkout** — rejected by the owner; pending carts/orders
  must not hold inventory.
- **Keep integer stock or allow backorders** — rejected: integer stock cannot
  represent order milli-units, and launch must block unavailable quantity.

## Consequences

- Core/contract specs and foundation tasks must implement and verify the
  declared atomic-call graph before any module uses it.
- ADR-0015 remains the default: events handle effects; `ctx.callAtomic` is an
  exceptional all-or-nothing composition mechanism.
- Catalog/orders/customers specs must replace their conflicting stock and CRM
  contracts through the spec-rework loop.
- `catalog` owns stock balances and stock-adjusted events; `orders` owns the
  state transition and immutable money snapshots.
- Required tests include no reservation, checkout soft rejection, atomic
  success/rollback, two-order stock race, same-order retry, tenant isolation,
  untracked inventory, variant-only decrement, CRM/order rollback, declared
  edge enforcement, and nested atomic-call rejection.
