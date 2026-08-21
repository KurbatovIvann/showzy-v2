/**
 * Event subscriptions this worker delivers. Must list the same
 * `defineEventHandler` objects `apps/api/src/composition.ts` passes
 * through `eventSubscriptionRefs`.
 */
import { orderCardUpdaterSubscriptions } from "@showzy/chat";
import type { EventSubscription } from "@showzy/core";

export const workerSubscriptions: readonly EventSubscription[] = [
  ...orderCardUpdaterSubscriptions,
];
