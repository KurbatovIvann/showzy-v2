/**
 * Event delivery core (fnd-T17 — core.md §6, ADR-0012): the dispatcher
 * and executor **library**. The loops that call these live in
 * `apps/worker` (fnd-T27). Claim leases, retry/backoff, dead-letter
 * bookkeeping, and replay are implemented here (fnd-T18); core still owns
 * no process loop.
 *
 * This is the stable import surface; the implementation is split by
 * phase:
 *
 * - `delivery-dispatch.ts` — `dispatchOutboxBatch` claims undispatched
 *   outbox rows (FOR UPDATE SKIP LOCKED), materializes one
 *   `event_deliveries` row per registered consumer, and marks the events
 *   dispatched — all in one transaction, so a crash never leaves an event
 *   half-fanned-out.
 * - `delivery-execute.ts` — `findClaimableDeliveries` (bounded discovery)
 *   and `executeDelivery`, the special delivery entrypoint (not
 *   `ctx.call`): it runs the bound system action through the **normal
 *   execution pipeline inside the delivery transaction**, with the
 *   delivery row doubling as the idempotency reservation, plus the
 *   retry/dead-letter bookkeeping.
 * - `delivery-reservation-hook.ts` — the delivery-row idempotency hook
 *   `executeDelivery` swaps into the pipeline.
 * - `delivery-shared.ts` — the row-lock, routing-invariant, advisory-lock,
 *   ordering, and claim-ownership helpers both phases share.
 */
export {
  dispatchOutboxBatch,
  type OutboxDispatcherDeps,
  type OutboxDispatchResult,
} from "./delivery-dispatch.js";
export {
  DELIVERY_CLAIM_MARGIN_MS,
  DELIVERY_MAX_ATTEMPTS,
  DELIVERY_RETRY_BASE_MS,
  deliveryRetryDelayMs,
  executeDelivery,
  findClaimableDeliveries,
  type ClaimableDelivery,
  type DeliveryOutcome,
} from "./delivery-execute.js";
