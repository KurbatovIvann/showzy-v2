# ADR-0026: Golden-slice confirm is status-only

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: owner (+ Cursor Grok 4.6)

## Context

ADR-0021 requires `orders.confirm` to atomically revalidate and decrement
catalog-owned stock so concurrent confirmations cannot oversell. Catalog
does not yet own inventory columns (`stock_quantity_milli`,
`low_stock_threshold_milli`, `track_inventory`). Inventing those columns
or a `ctx.callAtomic` catalog callee in the golden write slice would be a
product fork the feature card (SHO-89) explicitly deferred.

The golden write slice still needs a closed confirm path: tenant write,
idempotency, audit, and `orders.confirmed` on the outbox, so later
Executors have a template and chat can project cards from events.

## Decision

Golden-slice `orders.confirm` is a status transition only: `new` →
`confirmed` plus handler-set `confirmed_at`. It declares no `ctx.call` and
no `atomicCalls`. ADR-0021 stock decrement waits until a catalog schema
task owns the inventory columns and a later orders ticket binds the
atomic capability.

## Alternatives considered

- **Implement ADR-0021 stock in this slice** — rejected: catalog has no
  inventory columns; adding them here is a table family the card forbade.
- **Skip confirm until stock exists** — rejected: the golden write
  template and the order-card projection need `orders.confirmed` now.
- **Reserve stock at create** — rejected: ADR-0021 states pending orders
  do not reserve stock.

## Consequences

- Confirm of a `new` order cannot oversell because it does not touch
  stock; oversell protection is a follow-up once catalog owns inventory.
- Chat-T2 can subscribe to `orders.confirmed` without waiting on stock.
- A later ticket must add the mutual `atomicCalls` / `atomicCallers` edge
  and must not silently change confirm into a stock write.
