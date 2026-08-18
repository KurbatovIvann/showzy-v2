/**
 * Event delivery core (fnd-T17 — core.md §6, ADR-0012): the dispatcher
 * and executor **library**. The loops that call these live in
 * `apps/worker` (fnd-T27); retry/backoff/dead-letter bookkeeping lands
 * with fnd-T18.
 *
 * Two halves:
 *
 * - `dispatchOutboxBatch` claims undispatched outbox rows (FOR UPDATE
 *   SKIP LOCKED), materializes one `event_deliveries` row per registered
 *   consumer, and marks the events dispatched — all in one transaction, so
 *   a crash never leaves an event half-fanned-out.
 * - `executeDelivery` is the special delivery entrypoint (not `ctx.call`):
 *   it runs the bound system action through the **normal execution
 *   pipeline inside the delivery transaction**. The pipeline's own
 *   transaction nests as a savepoint of the delivery transaction, and the
 *   delivery row doubles as the idempotency reservation (key = event ID) —
 *   the transition to `processed`, the action's effects, its audit row,
 *   and its emitted events commit together; a failure rolls all of them
 *   back and leaves the delivery `pending`.
 *
 * Ordering (core.md §6): a consumer handles only its earliest
 * non-processed delivery for an aggregate, and holds a transaction-scoped
 * `(consumer, aggregate)` advisory lock while applying effects. Nothing is
 * guaranteed across aggregates; handlers must still tolerate replays.
 */
import { randomUUID } from "node:crypto";

import { domainEvents, eventDeliveries } from "@showzy/db";
import { and, asc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import { CoreError, CoreInvariantError } from "../../errors/index.js";
import type {
  ActionPipelineDeps,
  ActionTransactionRunner,
  IdempotencyHook,
  PrincipalInvocation,
} from "../pipeline/types.js";
import type { EventSubscription } from "./define-event-handler.js";
import type { EventEnvelope } from "./envelope.js";

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

/** What one `executeDelivery` call did. */
export type DeliveryOutcome =
  | { readonly status: "processed" }
  /** The `(consumer, eventId)` row is already processed — redelivery no-op. */
  | { readonly status: "alreadyProcessed" }
  /** An earlier non-processed delivery exists for the aggregate — retry later. */
  | { readonly status: "deferred" }
  /** The bound action failed; everything rolled back, the row stays pending. */
  | { readonly status: "failed"; readonly error: CoreError };

/**
 * Executes one delivery: locks its row, enforces per-aggregate ordering
 * under the `(consumer, aggregate)` advisory lock, and runs the bound
 * action through the normal pipeline inside the delivery transaction.
 *
 * `deps` are the same pipeline dependencies the apps compose at boot
 * (audit hook, telemetry, …); the `idempotency` slot is replaced here —
 * the delivery row **is** the reservation (core.md §6), so no
 * `idempotency_keys` row is written for event-bound actions.
 */
export async function executeDelivery(
  deps: ActionPipelineDeps,
  options: {
    readonly subscription: EventSubscription;
    readonly eventId: string;
  },
): Promise<DeliveryOutcome> {
  const { subscription, eventId } = options;
  const now = deps.now ?? Date.now;

  try {
    return await deps.db.transaction(async (tx) => {
      // Lock this delivery for the whole execution. A concurrent executor
      // of the same (consumer, eventId) waits here, then observes
      // `processed` and no-ops — the at-least-once dedup (core.md §6).
      const [row] = await tx
        .select({
          deliveryStatus: eventDeliveries.status,
          event: {
            id: domainEvents.id,
            name: domainEvents.name,
            version: domainEvents.version,
            occurredAt: domainEvents.occurredAt,
            companyId: domainEvents.companyId,
            aggregateType: domainEvents.aggregateType,
            aggregateId: domainEvents.aggregateId,
            aggregateSequence: domainEvents.aggregateSequence,
            actorType: domainEvents.actorType,
            actorId: domainEvents.actorId,
            channel: domainEvents.channel,
            requestId: domainEvents.requestId,
            correlationId: domainEvents.correlationId,
            causationId: domainEvents.causationId,
            payload: domainEvents.payload,
          },
        })
        .from(eventDeliveries)
        .innerJoin(domainEvents, eq(eventDeliveries.eventId, domainEvents.id))
        .where(
          and(
            eq(eventDeliveries.consumer, subscription.consumer),
            eq(eventDeliveries.eventId, eventId),
          ),
        )
        .limit(1)
        .for("update", { of: eventDeliveries });
      if (row === undefined) {
        throw new CoreInvariantError(
          `no delivery row for consumer "${subscription.consumer}" of event ${eventId} — dispatch materializes deliveries before execution (core.md §6)`,
        );
      }
      if (row.event.name !== subscription.event.name) {
        throw new CoreInvariantError(
          `delivery of event ${eventId} ("${row.event.name}") was routed to the subscription of "${subscription.event.name}" — executor composition bug`,
        );
      }
      if (row.deliveryStatus === "processed") {
        return { status: "alreadyProcessed" } as const;
      }
      if (row.deliveryStatus !== "pending") {
        // `processing`/`dead` are produced by the fnd-T18 claim/retry
        // machinery; nothing in this slice creates them.
        throw new CoreInvariantError(
          `delivery for consumer "${subscription.consumer}" of event ${eventId} is "${row.deliveryStatus}" — states beyond pending/processed arrive with the retry protocol (fnd-T18)`,
        );
      }

      // Per-aggregate ordering, wall 1: the transaction-scoped advisory
      // lock serializes this consumer's work on one aggregate. Raw SQL
      // approved by db.md §7 / ADR-0012 ("transaction advisory locks for
      // per-aggregate delivery") — Drizzle has no advisory-lock API.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${subscription.consumer}), hashtext(${`${row.event.aggregateType}:${row.event.aggregateId}`}))`,
      );

      // Wall 2: only the earliest non-processed delivery of this aggregate
      // may run. A later delivery claimed first defers and retries after
      // the earlier one lands (or, post fnd-T18, parks dead and blocks the
      // aggregate for this consumer until replayed).
      const [earlier] = await tx
        .select({ eventId: eventDeliveries.eventId })
        .from(eventDeliveries)
        .innerJoin(domainEvents, eq(eventDeliveries.eventId, domainEvents.id))
        .where(
          and(
            eq(eventDeliveries.consumer, subscription.consumer),
            ne(eventDeliveries.status, "processed"),
            eq(domainEvents.aggregateType, row.event.aggregateType),
            eq(domainEvents.aggregateId, row.event.aggregateId),
            lt(domainEvents.aggregateSequence, row.event.aggregateSequence),
          ),
        )
        .limit(1);
      if (earlier !== undefined) {
        return { status: "deferred" } as const;
      }

      const envelope = buildEnvelope(row.event);
      const principal: PrincipalInvocation = {
        mode: "system",
        serviceName: subscription.consumer,
        // The event's stored company scope decides the context scope
        // (core.md §6): a null company exists only on declared global
        // events, whose bound actions declare systemScope "global".
        scope:
          row.event.companyId !== null
            ? { scope: "tenant", companyId: row.event.companyId }
            : { scope: "global" },
      };

      // The pipeline runs with this delivery transaction as its runner, so
      // its "execution transaction" nests as a savepoint here; the
      // idempotency slot becomes the delivery row itself.
      await subscription.invoke(
        {
          ...deps,
          db: tx,
          hooks: {
            ...deps.hooks,
            idempotency: createDeliveryReservationHook({
              consumer: subscription.consumer,
              eventId,
              now,
            }),
          },
        },
        {
          input: envelope,
          request: {
            // A fresh id per delivery attempt; correlation stays the
            // emitting request's chain and causation is the delivered
            // event (core.md §6) — the consumer's own emissions carry it.
            requestId: randomUUID(),
            correlationId: row.event.correlationId,
            causationId: row.event.id,
            channel: "system",
            // The reservation key is the event ID (core.md §6). The hook
            // below never reads it, but the pipeline meta says so
            // explicitly for logs and later protocol slots.
            idempotencyKey: row.event.id,
          },
          principal,
        },
      );

      return { status: "processed" } as const;
    });
  } catch (error) {
    return { status: "failed", error: toCoreError(error) };
  }
}

/**
 * The delivery-row idempotency reservation (core.md §6): `reserve` is a
 * pass-through — the executor already holds the row lock and proved the
 * status is `pending` — and `finalize` flips it to `processed` inside the
 * action's transaction, so the transition commits atomically with the
 * consumer's effects. `markFailed` is deliberately empty: the rollback
 * leaves the row `pending`, and attempt/backoff bookkeeping is fnd-T18.
 */
function createDeliveryReservationHook(options: {
  readonly consumer: string;
  readonly eventId: string;
  readonly now: () => number;
}): IdempotencyHook {
  return {
    reserve: () => Promise.resolve({ kind: "execute", reservation: null }),
    finalize: async ({ tx }) => {
      await tx
        .update(eventDeliveries)
        .set({ status: "processed", processedAt: new Date(options.now()) })
        .where(
          and(
            eq(eventDeliveries.consumer, options.consumer),
            eq(eventDeliveries.eventId, options.eventId),
          ),
        );
    },
    markFailed: () => Promise.resolve(),
  };
}

type OutboxEventRow = {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly companyId: string | null;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSequence: bigint;
  readonly actorType: string;
  readonly actorId: string;
  readonly channel: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly payload: unknown;
};

/** Builds the JSON-safe envelope (envelope.ts) from the stored outbox row. */
function buildEnvelope(event: OutboxEventRow): EventEnvelope {
  return {
    eventId: event.id,
    name: event.name,
    version: event.version,
    occurredAt: event.occurredAt.toISOString(),
    companyId: event.companyId,
    aggregate: {
      type: event.aggregateType,
      id: event.aggregateId,
      sequence: event.aggregateSequence.toString(),
    },
    actor: {
      type: narrowStored(event.id, "actor_type", event.actorType, [
        "user",
        "system",
      ] as const),
      id: event.actorId,
      channel: narrowStored(event.id, "channel", event.channel, [
        "ui",
        "ai",
        "system",
        "webhook",
      ] as const),
    },
    requestId: event.requestId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    payload: event.payload,
  };
}

/**
 * Narrows a stored text column to its CHECK-constrained union without a
 * cast. Failing is a server bug — the DB CHECK makes it impossible.
 */
function narrowStored<const TValues extends readonly string[]>(
  eventId: string,
  column: string,
  value: string,
  values: TValues,
): TValues[number] {
  for (const candidate of values) {
    if (value === candidate) {
      return candidate;
    }
  }
  throw new CoreInvariantError(
    `outbox row ${eventId} carries ${column} "${value}" outside its CHECK constraint`,
  );
}

/** Everything leaving the executor is a typed core error (core.md §11). */
function toCoreError(error: unknown): CoreError {
  if (error instanceof CoreError) {
    return error;
  }
  return new CoreInvariantError(
    "event delivery failed outside the typed error vocabulary",
    { cause: error },
  );
}
