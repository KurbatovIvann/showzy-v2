/**
 * Helpers shared by the two phases of `executeDelivery` (fnd-T17/T18 —
 * core.md §6, ADR-0012): the short claim transaction and the delivery
 * transaction both lock the same `(consumer, eventId)` row, assert the
 * same routing invariant, serialize on the same `(consumer, aggregate)`
 * advisory lock, and enforce the same earliest-first aggregate ordering.
 * Keeping the four decisions in one place means the claim phase and the
 * execute phase cannot drift apart.
 */
import { domainEvents, eventDeliveries, type Tx } from "@showzy/db";
import { and, eq, lt, ne, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { CoreInvariantError } from "../../errors/index.js";

/**
 * Correlated aliases for the earliest-unprocessed predecessor probe.
 * Starting from `domain_events` uses `domain_events_aggregate_sequence_uq`
 * (type, id, sequence) then the delivery PK `(consumer, event_id)`.
 */
const earlierEvents = alias(domainEvents, "earlier_aggregate_events");
const earlierDeliveries = alias(
  eventDeliveries,
  "earlier_aggregate_deliveries",
);

/** The stored outbox event, as both delivery phases read it. */
export type OutboxEventRow = {
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

/** One `(consumer, eventId)` delivery row, locked with its outbox event. */
export interface LockedDelivery {
  readonly status: string;
  readonly nextAttemptAt: Date | null;
  readonly claimedAt: Date | null;
  readonly claimedBy: string | null;
  readonly event: OutboxEventRow;
}

/**
 * Locks the delivery row (`FOR UPDATE OF event_deliveries`) joined with
 * its outbox event. A missing row is a dispatcher invariant violation —
 * dispatch materializes deliveries before execution (core.md §6).
 */
export async function lockDeliveryRow(
  tx: Tx,
  options: {
    readonly consumer: string;
    readonly eventId: string;
  },
): Promise<LockedDelivery> {
  const [row] = await tx
    .select({
      status: eventDeliveries.status,
      nextAttemptAt: eventDeliveries.nextAttemptAt,
      claimedAt: eventDeliveries.claimedAt,
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
        eq(eventDeliveries.consumer, options.consumer),
        eq(eventDeliveries.eventId, options.eventId),
      ),
    )
    .limit(1)
    .for("update", { of: eventDeliveries });
  if (row === undefined) {
    throw new CoreInvariantError(
      `no delivery row for consumer "${options.consumer}" of event ${options.eventId} — dispatch materializes deliveries before execution (core.md §6)`,
    );
  }
  return row;
}

/** The executor must have selected the subscription matching the event. */
export function assertDeliveryRouting(options: {
  readonly eventId: string;
  readonly storedEventName: string;
  readonly subscribedEventName: string;
}): void {
  if (options.storedEventName !== options.subscribedEventName) {
    throw new CoreInvariantError(
      `delivery of event ${options.eventId} ("${options.storedEventName}") was routed to the subscription of "${options.subscribedEventName}" — executor composition bug`,
    );
  }
}

/**
 * The transaction-scoped `(consumer, aggregate)` advisory lock serializing
 * one consumer's work on one aggregate. Raw SQL approved by db.md §7 /
 * ADR-0012 ("transaction advisory locks for per-aggregate delivery") —
 * Drizzle has no advisory-lock API.
 */
export async function acquireAggregateAdvisoryLock(
  tx: Tx,
  options: {
    readonly consumer: string;
    readonly aggregateType: string;
    readonly aggregateId: string;
  },
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${options.consumer}), hashtext(${`${options.aggregateType}:${options.aggregateId}`}))`,
  );
}

/**
 * Earliest-first aggregate ordering (core.md §6): whether this consumer
 * still has a non-processed delivery of the same aggregate with a lower
 * sequence — if so, the queried delivery must defer. Dead and not-yet-due
 * predecessors count; `processed` does not.
 *
 * Discovery (`findClaimableDeliveries`) uses the same subquery as a
 * `NOT EXISTS` filter so blocked successors cannot fill the bounded batch
 * (SHO-435). Claim still re-runs this probe under the advisory lock.
 */
export function earlierUnprocessedDeliverySubquery(
  db: Pick<Tx, "select">,
  options: {
    readonly consumer: SQLWrapper | string;
    readonly aggregateType: SQLWrapper | string;
    readonly aggregateId: SQLWrapper | string;
    readonly aggregateSequence: SQLWrapper | bigint;
  },
) {
  return db
    .select({ eventId: earlierDeliveries.eventId })
    .from(earlierEvents)
    .innerJoin(
      earlierDeliveries,
      and(
        eq(earlierDeliveries.eventId, earlierEvents.id),
        eq(earlierDeliveries.consumer, options.consumer),
      ),
    )
    .where(
      and(
        ne(earlierDeliveries.status, "processed"),
        eq(earlierEvents.aggregateType, options.aggregateType),
        eq(earlierEvents.aggregateId, options.aggregateId),
        lt(earlierEvents.aggregateSequence, options.aggregateSequence),
      ),
    )
    .limit(1);
}

export async function hasEarlierUnprocessedDelivery(
  tx: Tx,
  options: {
    readonly consumer: string;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly aggregateSequence: bigint;
  },
): Promise<boolean> {
  const [earlier] = await earlierUnprocessedDeliverySubquery(tx, options);
  return earlier !== undefined;
}

/**
 * The claim-ownership predicate: the row is still `processing` and still
 * owned by this worker. Guards every post-claim transition (release,
 * failure bookkeeping, finalize) against a newer claim.
 */
export function ownedProcessingDelivery(options: {
  readonly consumer: string;
  readonly eventId: string;
  readonly claimedBy: string;
}): SQL | undefined {
  return and(
    eq(eventDeliveries.consumer, options.consumer),
    eq(eventDeliveries.eventId, options.eventId),
    eq(eventDeliveries.status, "processing"),
    eq(eventDeliveries.claimedBy, options.claimedBy),
  );
}
