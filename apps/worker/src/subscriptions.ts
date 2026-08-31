/**
 * Event subscriptions this worker delivers — the exact array the API
 * composition registers for contract-check (`@showzy/api/subscriptions`,
 * SHO-279). Single source: a subscription registered there is delivered
 * here by construction; there is no second hand-maintained list to forget.
 */
export { registeredEventSubscriptions as workerSubscriptions } from "@showzy/api/subscriptions";
