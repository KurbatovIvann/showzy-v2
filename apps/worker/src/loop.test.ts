import {
  defineEvent,
  defineEventHandler,
  eventEnvelopeSchema,
  implementAction,
  type ClaimableDelivery,
} from "@showzy/core";
import { defineActionContract } from "@showzy/core/contract";
import { CoreInvariantError } from "@showzy/core/errors";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  consumerEventKey,
  createWorkerLoop,
  indexSubscriptionsByConsumerEvent,
  type TickResult,
} from "./loop.js";

const silent = pino({ enabled: false });

function emptyTick(): TickResult {
  return {
    claimedEvents: 0,
    createdDeliveries: 0,
    processed: 0,
    alreadyProcessed: 0,
    deferred: 0,
    failed: 0,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for worker loop condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("createWorkerLoop", () => {
  it("coalesces overlapping ticks into one follow-up run", async () => {
    const gates: Array<
      (result: { claimedEvents: number; createdDeliveries: number }) => void
    > = [];
    let dispatchCount = 0;
    const loop = createWorkerLoop({
      workerId: "coalesce",
      logger: silent,
      pollIntervalMs: 60_000,
      dispatch: () => {
        dispatchCount += 1;
        return new Promise((resolve) => {
          gates.push(resolve);
        });
      },
      findDue: () => Promise.resolve([]),
      execute: () => Promise.resolve({ status: "processed" }),
      cleanup: () => Promise.resolve(0),
    });

    const first = loop.tick();
    await waitFor(() => dispatchCount === 1);
    void loop.tick();
    void loop.tick();
    const firstGate = gates[0];
    if (firstGate === undefined) {
      throw new Error("expected a blocked dispatch");
    }
    firstGate({ claimedEvents: 0, createdDeliveries: 0 });
    await waitFor(() => dispatchCount === 2);
    const secondGate = gates[1];
    if (secondGate === undefined) {
      throw new Error("expected the coalesced dispatch");
    }
    secondGate({ claimedEvents: 0, createdDeliveries: 0 });
    await first;
    expect(dispatchCount).toBe(2);
    await loop.stop();
  });

  it("drains an in-flight execute before stop resolves", async () => {
    const delivery: ClaimableDelivery = {
      consumer: "fixture.consumer",
      eventId: "11111111-1111-4111-8111-111111111111",
      eventName: "fixture.happened",
    };
    let release: ((outcome: { status: "processed" }) => void) | undefined;
    let executing = 0;
    const loop = createWorkerLoop({
      workerId: "drain",
      logger: silent,
      pollIntervalMs: 60_000,
      dispatch: () =>
        Promise.resolve({ claimedEvents: 0, createdDeliveries: 0 }),
      findDue: () => Promise.resolve([delivery]),
      execute: () => {
        executing += 1;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
      cleanup: () => Promise.resolve(0),
    });

    const ticking = loop.tick();
    await waitFor(() => executing === 1);
    let stopped = false;
    const stopping = loop.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    if (release === undefined) {
      throw new Error("expected an in-flight execute");
    }
    release({ status: "processed" });
    await stopping;
    await ticking;
    expect(stopped).toBe(true);
    expect(executing).toBe(1);
  });

  it("does not claim further work after stop", async () => {
    let executed = 0;
    const loop = createWorkerLoop({
      workerId: "stopped",
      logger: silent,
      pollIntervalMs: 60_000,
      dispatch: () =>
        Promise.resolve({ claimedEvents: 1, createdDeliveries: 1 }),
      findDue: () =>
        Promise.resolve([
          {
            consumer: "fixture.consumer",
            eventId: "11111111-1111-4111-8111-111111111111",
            eventName: "fixture.happened",
          },
        ]),
      execute: () => {
        executed += 1;
        return Promise.resolve({ status: "processed" });
      },
      cleanup: () => Promise.resolve(0),
    });

    await loop.stop();
    expect(await loop.tick()).toEqual(emptyTick());
    expect(executed).toBe(0);
  });

  it("does not run idempotency cleanup from the outbox loop", async () => {
    let cleanups = 0;
    const loop = createWorkerLoop({
      workerId: "no-cleanup-timer",
      logger: silent,
      pollIntervalMs: 60_000,
      dispatch: () =>
        Promise.resolve({ claimedEvents: 0, createdDeliveries: 0 }),
      findDue: () => Promise.resolve([]),
      execute: () => Promise.resolve({ status: "processed" }),
      cleanup: () => {
        cleanups += 1;
        return Promise.resolve(0);
      },
    });

    await loop.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cleanups).toBe(0);
    await loop.stop();
  });
});

const placed = defineEvent({
  name: "loopFixture.placed",
  version: 1,
  scope: "tenant",
  payload: z.object({ orderId: z.uuid() }),
});

const confirmed = defineEvent({
  name: "loopFixture.confirmed",
  version: 1,
  scope: "tenant",
  payload: z.object({ orderId: z.uuid() }),
});

const upsertAction = implementAction(
  defineActionContract({
    name: "loopFixtureChat.upsertCard",
    description: "Same system action bound to two events.",
    principal: "system",
    systemScope: "tenant",
    transport: "internal",
    aiExposure: "internal",
    input: eventEnvelopeSchema(z.object({ orderId: z.uuid() })),
    output: z.object({ ok: z.boolean() }),
    permissions: [],
    risk: "write",
    requiresConfirmation: false,
    idempotent: true,
    emits: [],
    atomicCalls: [],
    atomicCallers: [],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: () => Promise.resolve({ ok: true }),
    auditTarget: () => ({ type: "order-card", id: "fixture" }),
  },
);

const placedBinding = defineEventHandler({
  event: placed,
  consumer: "loopFixtureChat.card-updater",
  action: upsertAction,
});

const confirmedBinding = defineEventHandler({
  event: confirmed,
  consumer: "loopFixtureChat.card-updater",
  action: upsertAction,
});

describe("indexSubscriptionsByConsumerEvent (core.md §6)", () => {
  it("keeps two same-consumer bindings when their events differ", () => {
    const indexed = indexSubscriptionsByConsumerEvent([
      placedBinding,
      confirmedBinding,
    ]);
    expect(indexed.size).toBe(2);
    expect(
      indexed.get(consumerEventKey(placedBinding.consumer, placed.name)),
    ).toBe(placedBinding);
    expect(
      indexed.get(consumerEventKey(confirmedBinding.consumer, confirmed.name)),
    ).toBe(confirmedBinding);
    expect(indexed.get(placedBinding.consumer)).toBeUndefined();
  });

  it("fails closed on a duplicate (consumer, event) binding", () => {
    expect(() =>
      indexSubscriptionsByConsumerEvent([placedBinding, placedBinding]),
    ).toThrow(CoreInvariantError);
  });
});
