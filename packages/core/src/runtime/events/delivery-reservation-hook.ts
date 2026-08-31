/**
 * The delivery-row idempotency reservation (fnd-T17 — core.md §6): when
 * `executeDelivery` runs the bound action through the pipeline, the
 * delivery row **is** the reservation, so no `idempotency_keys` row is
 * written for event-bound actions.
 */
import { eventDeliveries } from "@showzy/db";

import { CoreInvariantError } from "../../errors/index.js";
import type { IdempotencyHook } from "../pipeline/types.js";
import { ownedProcessingDelivery } from "./delivery-shared.js";

/**
 * `reserve` is a pass-through — the executor already holds the row lock
 * and proved the status is owned `processing` — and `finalize` flips it to
 * `processed` inside the action's transaction, so the transition commits
 * atomically with the consumer's effects. `markFailed` is deliberately
 * empty: after rollback, the outer delivery entrypoint records
 * retry/dead-letter state separately.
 */
export function createDeliveryReservationHook(options: {
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
          ownedProcessingDelivery({
            consumer: options.consumer,
            eventId: options.eventId,
            claimedBy: options.claimedBy,
          }),
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
