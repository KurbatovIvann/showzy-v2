/**
 * Event subscriptions this worker delivers. Empty until domain modules
 * exist; fnd-T42 (chat order-card) is the first real binding.
 */
import type { EventSubscription } from "@showzy/core";

export const workerSubscriptions: readonly EventSubscription[] = [];
