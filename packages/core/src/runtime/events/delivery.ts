/**
 * Event delivery core (fnd-T17 — core.md §6, ADR-0012): the dispatcher
 * and executor **library**. The loops that call these live in
 * `apps/worker` (fnd-T27). Claim leases, retry/backoff, dead-letter
 * bookkeeping, and replay are implemented here (fnd-T18); core still owns
 * no process loop.
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
 *   back before separate retry/dead-letter bookkeeping commits.
 *
 * Ordering (core.md §6): a consumer handles only its earliest
 * non-processed delivery for an aggregate, and holds a transaction-scoped
 * `(consumer, aggregate)` advisory lock while applying effects. Nothing is
 * guaranteed across aggregates; handlers must still tolerate replays.
 */
import { randomUUID } from "node:crypto";

import { domainEvents, eventDeliveries } from "@showzy/db";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

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
const DEFAULT_DELIVERY_BATCH_SIZE = 100;

/** Five failed handler attempts park one consumer's delivery (core.md §6). */
export const DELIVERY_MAX_ATTEMPTS = 5;
/** Retry delays are 1s, 2s, 4s, and 8s after failures one through four. */
export const DELIVERY_RETRY_BASE_MS = 1_000;
/**
 * A claim remains live for the bound action timeout plus this commit/clock
 * margin. That prevents a second worker from stealing an action that is
 * still inside its declared whole-pipeline deadline.
 */
export const DELIVERY_CLAIM_MARGIN_MS = 30_000;

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
  /**
   * Not runnable now: not due, actively claimed, dead, or blocked by an
   * earlier non-processed delivery for the aggregate.
   */
  | { readonly status: "deferred" }
  /** The bound action failed; `retryAt: null` means this attempt parked dead. */
  | {
      readonly status: "failed";
      readonly error: CoreError;
      readonly retryAt: string | null;
    };

export interface ClaimableDelivery {
  readonly consumer: string;
  readonly eventId: string;
  /**
   * Outbox event name (`domain_events.name`). The worker executor keys
   * subscriptions by `(consumer, eventName)` so one consumer id may bind
   * multiple events without querying foundation tables (core.md §6).
   */
  readonly eventName: string;
}

/**
 * Finds a bounded batch that `executeDelivery` may attempt to claim. This
 * is a non-authoritative discovery read: concurrent workers may see the
 * same row, while the short claim transaction below chooses one owner.
 *
 * Keeping discovery in core means the fnd-T27 worker loop never queries
 * foundation tables directly. Each row includes `eventName` so the worker
 * can select the matching `EventSubscription` when one consumer binds
 * more than one event.
 */
export async function findClaimableDeliveries(
  deps: Pick<ActionPipelineDeps, "db">,
  options: {
    readonly subscriptions: readonly EventSubscription[];
    readonly now?: () => number;
    readonly batchSize?: number;
  },
): Promise<ClaimableDelivery[]> {
  if (options.subscriptions.length === 0) {
    return [];
  }
  const nowMs = (options.now ?? Date.now)();
  const nowDate = new Date(nowMs);
  const consumerConditions = options.subscriptions.map((subscription) =>
    and(
      eq(eventDeliveries.consumer, subscription.consumer),
      eq(domainEvents.name, subscription.event.name),
      or(
        and(
          eq(eventDeliveries.status, "pending"),
          or(
            isNull(eventDeliveries.nextAttemptAt),
            lte(eventDeliveries.nextAttemptAt, nowDate),
          ),
        ),
        and(
          eq(eventDeliveries.status, "processing"),
          or(
            isNull(eventDeliveries.claimedAt),
            lte(
              eventDeliveries.claimedAt,
              new Date(
                nowMs -
                  subscription.contract.timeout -
                  DELIVERY_CLAIM_MARGIN_MS,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  const predicate = or(...consumerConditions);
  if (predicate === undefined) {
    return [];
  }

  return await deps.db.transaction(async (tx) =>
    tx
      .select({
        consumer: eventDeliveries.consumer,
        eventId: eventDeliveries.eventId,
        eventName: domainEvents.name,
      })
      .from(eventDeliveries)
      .innerJoin(domainEvents, eq(eventDeliveries.eventId, domainEvents.id))
      .where(predicate)
      .orderBy(asc(eventDeliveries.nextAttemptAt), asc(eventDeliveries.eventId))
      .limit(options.batchSize ?? DEFAULT_DELIVERY_BATCH_SIZE),
  );
}

/**
 * Executes one delivery: locks its row, enforces per-aggregate ordering
 * under the `(consumer, aggregate)` advisory lock, and runs the bound
 * action through the normal pipeline inside the delivery transaction.
 *
 * `deps` are the same pipeline dependencies the apps compose at boot
 * (audit hook, telemetry, …); the `idempotency` slot is replaced here —
 * the delivery row **is** the reservation (core.md §6), so no
 * `idempotency_keys` row is written for event-bound actions.
 *
 * The short claim transaction commits before the action transaction. A
 * process crash therefore leaves `processing` plus an owner/timestamp;
 * another worker may reclaim it only after the action timeout plus
 * `DELIVERY_CLAIM_MARGIN_MS`.
 */
export async function executeDelivery(
  deps: ActionPipelineDeps,
  options: {
    readonly subscription: EventSubscription;
    readonly eventId: string;
    /** Unique worker/process instance id persisted as the claim owner. */
    readonly claimedBy: string;
  },
): Promise<DeliveryOutcome> {
  const { subscription, eventId, claimedBy } = options;
  const now = deps.now ?? Date.now;

  let claim: ClaimResult;
  try {
    claim = await claimDelivery(deps, {
      subscription,
      eventId,
      claimedBy,
      now,
    });
  } catch (error) {
    return {
      status: "failed",
      error: toCoreError(error),
      retryAt: null,
    };
  }
  if (claim !== "claimed") {
    return { status: claim };
  }

  try {
    return await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          deliveryStatus: eventDeliveries.status,
          claimedBy: eventDeliveries.claimedBy,
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
      if (row.deliveryStatus !== "processing" || row.claimedBy !== claimedBy) {
        // A newer worker took the lease between the claim commit and this
        // transaction (core.md §6). Leave their row alone.
        return { status: "deferred" } as const;
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
      // the earlier one lands (or parks dead and blocks the aggregate for
      // this consumer until replayed).
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
        // A rare dispatcher race can materialize an earlier event after
        // this delivery's short claim transaction. Release this claim and
        // undo the claim-attempt count because no handler ran.
        await tx
          .update(eventDeliveries)
          .set({
            status: "pending",
            attempts: sql`GREATEST(${eventDeliveries.attempts} - 1, 0)`,
            nextAttemptAt: new Date(now()),
            claimedAt: null,
            claimedBy: null,
          })
          .where(
            and(
              eq(eventDeliveries.consumer, subscription.consumer),
              eq(eventDeliveries.eventId, eventId),
              eq(eventDeliveries.status, "processing"),
              eq(eventDeliveries.claimedBy, claimedBy),
            ),
          );
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
              claimedBy,
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
    const coreError = toCoreError(error);
    const recorded = await recordDeliveryFailure(deps, {
      consumer: subscription.consumer,
      eventId,
      claimedBy,
      error: coreError,
      now,
    });
    if (!recorded.recorded) {
      return { status: "deferred" };
    }
    return {
      status: "failed",
      error: coreError,
      retryAt: recorded.retryAt?.toISOString() ?? null,
    };
  }
}

type ClaimResult = "claimed" | "alreadyProcessed" | "deferred";

/**
 * Acquires one due delivery. This is intentionally per-delivery: fnd-T27's
 * worker loop discovers due rows, while this transaction remains the single
 * authority for due-time checks, stale-claim takeover, attempt increments,
 * and aggregate ordering.
 */
async function claimDelivery(
  deps: ActionPipelineDeps,
  options: {
    readonly subscription: EventSubscription;
    readonly eventId: string;
    readonly claimedBy: string;
    readonly now: () => number;
  },
): Promise<ClaimResult> {
  const { subscription, eventId, claimedBy, now } = options;

  return await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        deliveryStatus: eventDeliveries.status,
        nextAttemptAt: eventDeliveries.nextAttemptAt,
        claimedAt: eventDeliveries.claimedAt,
        claimedBy: eventDeliveries.claimedBy,
        eventName: domainEvents.name,
        aggregateType: domainEvents.aggregateType,
        aggregateId: domainEvents.aggregateId,
        aggregateSequence: domainEvents.aggregateSequence,
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
    if (row.eventName !== subscription.event.name) {
      throw new CoreInvariantError(
        `delivery of event ${eventId} ("${row.eventName}") was routed to the subscription of "${subscription.event.name}" — executor composition bug`,
      );
    }
    if (row.deliveryStatus === "processed") {
      return "alreadyProcessed";
    }
    if (row.deliveryStatus === "dead") {
      return "deferred";
    }

    const nowMs = now();
    if (
      row.deliveryStatus === "pending" &&
      row.nextAttemptAt !== null &&
      row.nextAttemptAt.getTime() > nowMs
    ) {
      return "deferred";
    }
    if (row.deliveryStatus === "processing") {
      if (row.claimedAt === null || row.claimedBy === null) {
        throw new CoreInvariantError(
          `processing delivery for consumer "${subscription.consumer}" of event ${eventId} has incomplete claim ownership`,
        );
      }
      const claimExpiresAt =
        row.claimedAt.getTime() +
        subscription.contract.timeout +
        DELIVERY_CLAIM_MARGIN_MS;
      if (claimExpiresAt > nowMs) {
        return "deferred";
      }
    }

    // Serialize claim/order decisions with execution on this consumer's
    // aggregate. This avoids spending an attempt on a known-later event.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${subscription.consumer}), hashtext(${`${row.aggregateType}:${row.aggregateId}`}))`,
    );
    const [earlier] = await tx
      .select({ eventId: eventDeliveries.eventId })
      .from(eventDeliveries)
      .innerJoin(domainEvents, eq(eventDeliveries.eventId, domainEvents.id))
      .where(
        and(
          eq(eventDeliveries.consumer, subscription.consumer),
          ne(eventDeliveries.status, "processed"),
          eq(domainEvents.aggregateType, row.aggregateType),
          eq(domainEvents.aggregateId, row.aggregateId),
          lt(domainEvents.aggregateSequence, row.aggregateSequence),
        ),
      )
      .limit(1);
    if (earlier !== undefined) {
      return "deferred";
    }

    const claimedAt = new Date(nowMs);
    const [claimed] = await tx
      .update(eventDeliveries)
      .set({
        status: "processing",
        attempts: sql`${eventDeliveries.attempts} + 1`,
        nextAttemptAt: null,
        claimedAt,
        claimedBy,
      })
      .where(
        and(
          eq(eventDeliveries.consumer, subscription.consumer),
          eq(eventDeliveries.eventId, eventId),
        ),
      )
      .returning({ eventId: eventDeliveries.eventId });
    if (claimed === undefined) {
      throw new CoreInvariantError(
        `delivery claim for consumer "${subscription.consumer}" of event ${eventId} vanished while locked`,
      );
    }
    return "claimed";
  });
}

/** Exponential retry schedule after one-based failed attempt numbers. */
export function deliveryRetryDelayMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new CoreInvariantError(
      `delivery retry attempt must be a positive integer, received ${String(attempt)}`,
    );
  }
  return DELIVERY_RETRY_BASE_MS * 2 ** (attempt - 1);
}

type DeliveryFailureRecord =
  | { readonly recorded: true; readonly retryAt: Date | null }
  | { readonly recorded: false };

/**
 * Failure bookkeeping runs after the action transaction rolled back. The
 * owner predicate prevents a stale worker from overwriting a newer claim —
 * that race returns `recorded: false` so the caller can defer instead of
 * throwing out of the executor.
 */
async function recordDeliveryFailure(
  deps: ActionPipelineDeps,
  options: {
    readonly consumer: string;
    readonly eventId: string;
    readonly claimedBy: string;
    readonly error: CoreError;
    readonly now: () => number;
  },
): Promise<DeliveryFailureRecord> {
  const result = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select({ attempts: eventDeliveries.attempts })
      .from(eventDeliveries)
      .where(
        and(
          eq(eventDeliveries.consumer, options.consumer),
          eq(eventDeliveries.eventId, options.eventId),
          eq(eventDeliveries.status, "processing"),
          eq(eventDeliveries.claimedBy, options.claimedBy),
        ),
      )
      .limit(1)
      .for("update");
    if (row === undefined) {
      return { recorded: false } as const;
    }

    const dead = row.attempts >= DELIVERY_MAX_ATTEMPTS;
    const retryAt = dead
      ? null
      : new Date(options.now() + deliveryRetryDelayMs(row.attempts));
    await tx
      .update(eventDeliveries)
      .set({
        status: dead ? "dead" : "pending",
        nextAttemptAt: retryAt,
        claimedAt: null,
        claimedBy: null,
        // Persist only typed, client-safe text; causes/internal diagnostics
        // stay in structured runtime telemetry and never enter the DB.
        lastError: `${options.error.code}: ${options.error.clientMessage}`,
      })
      .where(
        and(
          eq(eventDeliveries.consumer, options.consumer),
          eq(eventDeliveries.eventId, options.eventId),
        ),
      );
    return { recorded: true, attempts: row.attempts, dead, retryAt } as const;
  });

  if (!result.recorded) {
    return { recorded: false };
  }
  if (result.dead) {
    deps.logger.error(
      {
        consumer: options.consumer,
        event_id: options.eventId,
        attempts: result.attempts,
        error_code: options.error.code,
      },
      "event delivery dead-lettered",
    );
  }
  return { recorded: true, retryAt: result.retryAt };
}

/**
 * The delivery-row idempotency reservation (core.md §6): `reserve` is a
 * pass-through — the executor already holds the row lock and proved the
 * status is owned `processing` — and `finalize` flips it to `processed` inside the
 * action's transaction, so the transition commits atomically with the
 * consumer's effects. `markFailed` is deliberately empty: after rollback,
 * the outer delivery entrypoint records retry/dead-letter state separately.
 */
function createDeliveryReservationHook(options: {
  readonly consumer: string;
  readonly eventId: string;
  readonly claimedBy: string;
  readonly now: () => number;
}): IdempotencyHook {
  return {
    probe: () => Promise.resolve({ kind: "fresh" }),
    reserve: () => Promise.resolve({ kind: "execute", reservation: null }),
    finalize: async ({ tx }) => {
      const [updated] = await tx
        .update(eventDeliveries)
        .set({
          status: "processed",
          nextAttemptAt: null,
          claimedAt: null,
          claimedBy: null,
          lastError: null,
          processedAt: new Date(options.now()),
        })
        .where(
          and(
            eq(eventDeliveries.consumer, options.consumer),
            eq(eventDeliveries.eventId, options.eventId),
            eq(eventDeliveries.status, "processing"),
            eq(eventDeliveries.claimedBy, options.claimedBy),
          ),
        )
        .returning({ eventId: eventDeliveries.eventId });
      if (updated === undefined) {
        throw new CoreInvariantError(
          `delivery for consumer "${options.consumer}" of event ${options.eventId} lost claim ownership before finalize`,
        );
      }
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
