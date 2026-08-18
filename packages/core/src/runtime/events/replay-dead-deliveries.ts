/**
 * Admin replay primitive (fnd-T18 — core.md §6). Replay is deliberately
 * scoped to one stable consumer, with an optional event id, so an operator
 * cannot accidentally wake every dead delivery in the system.
 */
import { eventDeliveries } from "@showzy/db";
import { and, eq } from "drizzle-orm";

import type { ActionTransactionRunner } from "../pipeline/types.js";

export interface DeliveryReplayDeps {
  readonly db: ActionTransactionRunner;
  /** Clock override for tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

export interface DeliveryReplayResult {
  readonly replayed: number;
}

/**
 * Changes matching `dead` rows back to fresh, immediately due `pending`
 * rows. The status predicate makes concurrent/repeated replay commands
 * idempotent; resetting attempts gives the operator-requested replay a new
 * five-attempt budget.
 */
export async function replayDeadDeliveries(
  deps: DeliveryReplayDeps,
  options: {
    readonly consumer: string;
    readonly eventId?: string;
  },
): Promise<DeliveryReplayResult> {
  const now = deps.now ?? Date.now;

  return await deps.db.transaction(async (tx) => {
    const replayed = await tx
      .update(eventDeliveries)
      .set({
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(now()),
        claimedAt: null,
        claimedBy: null,
        lastError: null,
        processedAt: null,
      })
      .where(
        and(
          eq(eventDeliveries.consumer, options.consumer),
          eq(eventDeliveries.status, "dead"),
          ...(options.eventId === undefined
            ? []
            : [eq(eventDeliveries.eventId, options.eventId)]),
        ),
      )
      .returning({ eventId: eventDeliveries.eventId });

    return { replayed: replayed.length };
  });
}
