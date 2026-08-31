/**
 * The outbox dispatcher half of event delivery (fnd-T17 — core.md §6,
 * ADR-0012): `dispatchOutboxBatch` claims undispatched outbox rows
 * (FOR UPDATE SKIP LOCKED), materializes one `event_deliveries` row per
 * registered consumer, and marks the events dispatched — all in one
 * transaction, so a crash never leaves an event half-fanned-out. The
 * loop that calls this lives in `apps/worker` (fnd-T27).
 */
import { domainEvents, eventDeliveries } from "@showzy/db";
import { asc, inArray, isNull } from "drizzle-orm";

import type { ActionTransactionRunner } from "../pipeline/types.js";
import type { EventSubscription } from "./define-event-handler.js";

/** What the dispatcher needs — a transaction opener and a clock. */
export interface OutboxDispatcherDeps {
  readonly db: ActionTransactionRunner;
  /** Clock override for tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

export interface OutboxDispatchResult {
  /** Outbox rows claimed and marked dispatched in this batch. */
  readonly claimedEvents: number;
  /** Delivery rows created (existing `(consumer, eventId)` rows are kept). */
  readonly createdDeliveries: number;
}

const DEFAULT_DISPATCH_BATCH_SIZE = 100;

/**
 * Claims a batch of undispatched outbox rows and fans them out into
 * per-consumer delivery rows. Safe to run from any number of concurrent
 * dispatchers: SKIP LOCKED partitions the backlog, delivery creation is
 * idempotent (`ON CONFLICT DO NOTHING` on the `(consumer, eventId)` PK —
 * db.md §4), and events with no registered consumer are still marked
 * dispatched (processed outbox rows are the retained event history).
 */
export async function dispatchOutboxBatch(
  deps: OutboxDispatcherDeps,
  options: {
    readonly subscriptions: readonly EventSubscription[];
    /** Dispatcher instance id recorded on the claimed rows. */
    readonly claimedBy: string;
    readonly batchSize?: number;
  },
): Promise<OutboxDispatchResult> {
  const now = deps.now ?? Date.now;
  const batchSize = options.batchSize ?? DEFAULT_DISPATCH_BATCH_SIZE;
  const consumersByEvent = indexConsumers(options.subscriptions);

  return await deps.db.transaction(async (tx) => {
    // The ADR-0012 outbox claim: FOR UPDATE SKIP LOCKED so concurrent
    // dispatchers never block on or double-claim one another's batch.
    // Drizzle expresses the locking clause natively — no raw SQL needed.
    const claimed = await tx
      .select({ id: domainEvents.id, name: domainEvents.name })
      .from(domainEvents)
      .where(isNull(domainEvents.dispatchedAt))
      // UUIDv7 ids are time-ordered, so this approximates emission order.
      .orderBy(asc(domainEvents.id))
      .limit(batchSize)
      .for("update", { skipLocked: true });
    if (claimed.length === 0) {
      return { claimedEvents: 0, createdDeliveries: 0 };
    }

    const dispatchedAt = new Date(now());
    const deliveryRows = claimed.flatMap((event) =>
      [...(consumersByEvent.get(event.name) ?? [])].map((consumer) => ({
        consumer,
        eventId: event.id,
        status: "pending" as const,
        nextAttemptAt: dispatchedAt,
      })),
    );
    let createdDeliveries = 0;
    if (deliveryRows.length > 0) {
      // Idempotent creation (db.md §4): a redispatched event keeps its
      // existing delivery rows — and their status — untouched.
      const inserted = await tx
        .insert(eventDeliveries)
        .values(deliveryRows)
        .onConflictDoNothing({
          target: [eventDeliveries.consumer, eventDeliveries.eventId],
        })
        .returning({ eventId: eventDeliveries.eventId });
      createdDeliveries = inserted.length;
    }
    await tx
      .update(domainEvents)
      .set({
        claimedAt: dispatchedAt,
        claimedBy: options.claimedBy,
        dispatchedAt,
      })
      .where(
        inArray(
          domainEvents.id,
          claimed.map((event) => event.id),
        ),
      );

    return { claimedEvents: claimed.length, createdDeliveries };
  });
}

function indexConsumers(
  subscriptions: readonly EventSubscription[],
): Map<string, Set<string>> {
  const consumersByEvent = new Map<string, Set<string>>();
  for (const subscription of subscriptions) {
    const consumers =
      consumersByEvent.get(subscription.event.name) ?? new Set<string>();
    consumers.add(subscription.consumer);
    consumersByEvent.set(subscription.event.name, consumers);
  }
  return consumersByEvent;
}
