import { registeredEventSubscriptions } from "@showzy/api/subscriptions";
import { describe, expect, it } from "vitest";

import { consumerEventKey, indexSubscriptionsByConsumerEvent } from "./loop.js";
import { workerSubscriptions } from "./subscriptions.js";

describe("workerSubscriptions", () => {
  it("is the same array the API composition registers (single source, SHO-279)", () => {
    // Identity, not deep equality: the worker must deliver exactly what the
    // contract-check registers, so a forgotten worker entry is impossible.
    expect(workerSubscriptions).toBe(registeredEventSubscriptions);
  });

  it("every registered subscription indexes into a worker executor", () => {
    expect(registeredEventSubscriptions.length).toBeGreaterThan(0);
    // The same (consumer, event) index the delivery loop executes from —
    // it throws on duplicates, so a mis-composed list cannot boot.
    const indexed = indexSubscriptionsByConsumerEvent(workerSubscriptions);
    for (const subscription of registeredEventSubscriptions) {
      expect(subscription.event.name).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
      expect(subscription.contract.name.length).toBeGreaterThan(0);
      expect(
        indexed.get(
          consumerEventKey(subscription.consumer, subscription.event.name),
        ),
      ).toBe(subscription);
    }
  });
});
