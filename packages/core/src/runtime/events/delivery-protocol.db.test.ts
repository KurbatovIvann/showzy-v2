/**
 * Integration tests for the event delivery core (fnd-T17 — core.md §6)
 * against the shared Testcontainers harness.
 *
 * Verifies:
 * - Dispatch materializes exactly one `event_deliveries` row per
 *   registered consumer and marks the outbox row dispatched in the same
 *   transaction; consumer-less events are dispatched with zero rows;
 *   delivery creation is idempotent and never touches existing rows.
 * - The delivery entrypoint runs the bound system action through the
 *   normal pipeline in the delivery transaction: validated envelope input,
 *   a system context scoped to the event's company (global for global
 *   events), and the consumer's own emitted events carrying the delivered
 *   event as `causationId`.
 * - Effects, the audit row, emitted events, and the `processed` transition
 *   commit atomically; a failing consumer rolls all of them back and
 *   leaves the delivery `pending` (retryable).
 * - Redelivery of `(consumer, eventId)` is a no-op.
 * - Per-aggregate ordering: a later delivery defers until the earlier one
 *   is processed — including under concurrent executors.
 * - One consumer's failure does not block another consumer of the event.
 */
import { randomUUID } from "node:crypto";

import {
  auditLog,
  companies,
  companyMembers,
  domainEvents,
  eventDeliveries,
  type ReadTx,
  type Tx,
} from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { createTestDatabase, type TestDatabase } from "@showzy/db/testing";
import { asc, eq, isNull } from "drizzle-orm";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { defineActionContract } from "../../contract/define-action-contract.js";
import { ConflictError, CoreInvariantError } from "../../errors/index.js";
import { createAuditHook } from "../audit/create-audit-hook.js";
import type { SystemCtx } from "../context/types.js";
import { implementAction } from "../implement-action.js";
import { executeAction } from "../pipeline/execute-action.js";
import type {
  ActionPipelineDeps,
  PipelineRequestMeta,
} from "../pipeline/types.js";
import { defineEvent } from "./define-event.js";
import { defineEventHandler } from "./define-event-handler.js";
import {
  dispatchOutboxBatch,
  executeDelivery,
  type DeliveryOutcome,
} from "./delivery.js";
import { eventEnvelopeSchema, type EventEnvelope } from "./envelope.js";

let database: TestDatabase;

const anna = "user_anna_delivery";
const companyA = randomUUID();
const silentLogger = pino({ enabled: false });

beforeAll(async () => {
  database = await createTestDatabase();
  await database.runtime.db
    .insert(user)
    .values([{ id: anna, name: "Anna", email: "anna-delivery@example.test" }]);
  await database.runtime.db.insert(companies).values([
    {
      id: companyA,
      name: "Delivery Co",
      slug: "delivery-co",
      prefix: "DL",
    },
  ]);
  // Owner short-circuits permission resolution (owner-all), so the fixture
  // needs no role_permission_defaults rows.
  await database.runtime.db.insert(companyMembers).values([
    {
      companyId: companyA,
      userId: anna,
      role: "owner" as const,
      permissions: { granted: [], denied: [] },
    },
  ]);
});

afterAll(async () => {
  await database.close();
});

// --- Events ---------------------------------------------------------------

const orderPlaced = defineEvent({
  name: "deliveryFixture.orderPlaced",
  version: 1,
  scope: "tenant",
  payload: z.object({ orderId: z.uuid() }),
});

/** Deliberately has no subscription — the consumer-less dispatch case. */
const orderNoted = defineEvent({
  name: "deliveryFixture.orderNoted",
  version: 1,
  scope: "tenant",
  payload: z.object({ orderId: z.uuid() }),
});

const sweepCompleted = defineEvent({
  name: "deliveryFixture.sweepCompleted",
  version: 1,
  scope: "global",
  payload: z.object({ scanned: z.number().int() }),
});

/** Emitted by the consumer — proves consumer emissions ride the delivery tx. */
const cardUpserted = defineEvent({
  name: "deliveryFixtureChat.cardUpserted",
  version: 1,
  scope: "tenant",
  payload: z.object({ orderId: z.uuid() }),
});

// --- Emitting fixtures ------------------------------------------------------

const placeContract = defineActionContract({
  name: "deliveryFixture.place",
  description: "Staff fixture emitting order events into the outbox.",
  principal: "staff",
  transport: "internal",
  aiExposure: "internal",
  input: z.object({
    orderId: z.uuid(),
    kind: z.enum(["placed", "noted"]).default("placed"),
  }),
  output: z.object({ ok: z.boolean() }),
  permissions: ["deliveryFixture:write"],
  risk: "write",
  requiresConfirmation: false,
  idempotent: false,
  emits: ["deliveryFixture.orderPlaced", "deliveryFixture.orderNoted"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
});

const placeAction = implementAction(placeContract, {
  handler: (input, ctx) => {
    ctx.emit(input.kind === "placed" ? orderPlaced : orderNoted, {
      aggregate: { type: "order", id: input.orderId },
      payload: { orderId: input.orderId },
    });
    return Promise.resolve({ ok: true });
  },
  auditTarget: () => ({ type: "order", id: "fixture" }),
});

const sweepContract = defineActionContract({
  name: "deliveryFixture.sweep",
  description: "Global system fixture emitting a global event.",
  principal: "system",
  systemScope: "global",
  transport: "internal",
  aiExposure: "internal",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  permissions: [],
  risk: "write",
  requiresConfirmation: false,
  idempotent: false,
  emits: ["deliveryFixture.sweepCompleted"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
});

const sweepAction = implementAction(sweepContract, {
  handler: (_input, ctx) => {
    ctx.emit(sweepCompleted, {
      aggregate: { type: "sweep", id: randomUUID() },
      payload: { scanned: 42 },
    });
    return Promise.resolve({ ok: true });
  },
  auditTarget: () => ({ type: "sweep", id: "fixture" }),
});

// --- Consumer fixtures ------------------------------------------------------

/** Observed by tests: one entry per committed-or-not handler run. */
interface CardRun {
  readonly envelope: EventEnvelope<{ orderId: string }>;
  readonly ctx: SystemCtx<ReadTx | Tx>;
}
const cardRuns: CardRun[] = [];
/** Event ids whose next chat-consumer run must fail (rollback tests). */
const failCardFor = new Set<string>();

const upsertCardContract = defineActionContract({
  name: "deliveryFixtureChat.upsertCard",
  description: "Chat-like consumer materializing a card per order event.",
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
  emits: ["deliveryFixtureChat.cardUpserted"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
});

const upsertCardAction = implementAction(upsertCardContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "system") {
      throw new CoreInvariantError("consumer fixture expected a system ctx");
    }
    cardRuns.push({ envelope: input, ctx });
    // The observable effect: an event emitted from inside the delivery.
    ctx.emit(cardUpserted, {
      aggregate: { type: "card", id: input.payload.orderId },
      payload: { orderId: input.payload.orderId },
    });
    if (failCardFor.has(input.eventId)) {
      throw new ConflictError("Injected consumer failure.");
    }
    return Promise.resolve({ ok: true });
  },
  auditTarget: () => ({ type: "order-card", id: "fixture" }),
});

/** Second consumer of the same event — the fan-out independence fixture. */
const failBillingFor = new Set<string>();

const registerOrderContract = defineActionContract({
  name: "deliveryFixtureBilling.registerOrder",
  description: "Billing-like second consumer of order events.",
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
});

const registerOrderAction = implementAction(registerOrderContract, {
  handler: (input) => {
    if (failBillingFor.has(input.eventId)) {
      throw new ConflictError("Injected billing failure.");
    }
    return Promise.resolve({ ok: true });
  },
  auditTarget: () => ({ type: "billing-order", id: "fixture" }),
});

let sweepCtx: SystemCtx<ReadTx | Tx> | undefined;

const recordSweepContract = defineActionContract({
  name: "deliveryFixtureOps.recordSweep",
  description: "Global consumer of the global sweep event.",
  principal: "system",
  systemScope: "global",
  transport: "internal",
  aiExposure: "internal",
  input: eventEnvelopeSchema(z.object({ scanned: z.number().int() })),
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
});

const recordSweepAction = implementAction(recordSweepContract, {
  handler: (_input, ctx) => {
    if (ctx.principal !== "system") {
      throw new CoreInvariantError("sweep fixture expected a system ctx");
    }
    sweepCtx = ctx;
    return Promise.resolve({ ok: true });
  },
  auditTarget: () => ({ type: "sweep-record", id: "fixture" }),
});

const cardSubscription = defineEventHandler({
  event: orderPlaced,
  consumer: "deliveryFixtureChat.card-updater",
  action: upsertCardAction,
});
const billingSubscription = defineEventHandler({
  event: orderPlaced,
  consumer: "deliveryFixtureBilling.order-registrar",
  action: registerOrderAction,
});
const sweepSubscription = defineEventHandler({
  event: sweepCompleted,
  consumer: "deliveryFixtureOps.sweep-recorder",
  action: recordSweepAction,
});
const allSubscriptions = [
  cardSubscription,
  billingSubscription,
  sweepSubscription,
];

// --- Helpers ----------------------------------------------------------------

function deps(withAudit = false): ActionPipelineDeps {
  return {
    db: database.runtime.db,
    logger: silentLogger,
    ...(withAudit
      ? { hooks: { audit: createAuditHook({ db: database.runtime.db }) } }
      : {}),
  };
}

function requestMeta(): PipelineRequestMeta {
  return {
    requestId: randomUUID(),
    correlationId: randomUUID(),
    channel: "ui",
  };
}

/** Emits one order event through the pipeline; returns its outbox id. */
async function placeOrder(
  orderId: string,
  kind: "placed" | "noted" = "placed",
): Promise<{ eventId: string; request: PipelineRequestMeta }> {
  const request = requestMeta();
  await executeAction(deps(), {
    action: placeAction,
    input: { orderId, kind },
    request,
    principal: {
      mode: "staff",
      session: { userId: anna },
      companySelector: companyA,
    },
  });
  const rows = await database.runtime.db
    .select({ id: domainEvents.id })
    .from(domainEvents)
    .where(eq(domainEvents.requestId, request.requestId));
  const eventId = rows[0]?.id;
  if (eventId === undefined || rows.length !== 1) {
    throw new Error("expected exactly one emitted outbox row");
  }
  return { eventId, request };
}

async function dispatch() {
  return dispatchOutboxBatch(
    { db: database.runtime.db },
    { subscriptions: allSubscriptions, claimedBy: "test-dispatcher" },
  );
}

async function deliveryRow(consumer: string, eventId: string) {
  const rows = await database.runtime.db
    .select()
    .from(eventDeliveries)
    .where(eq(eventDeliveries.eventId, eventId));
  return rows.find((row) => row.consumer === consumer);
}

async function emittedCardEvents(orderId: string) {
  return database.runtime.db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.aggregateId, orderId))
    .orderBy(asc(domainEvents.aggregateSequence))
    .then((rows) =>
      rows.filter((row) => row.name === "deliveryFixtureChat.cardUpserted"),
    );
}

/** Drives one delivery to completion, retrying deferred outcomes. */
async function driveToProcessed(
  subscription: typeof cardSubscription,
  eventId: string,
): Promise<void> {
  for (;;) {
    const outcome: DeliveryOutcome = await executeDelivery(deps(), {
      subscription,
      eventId,
    });
    if (
      outcome.status === "processed" ||
      outcome.status === "alreadyProcessed"
    ) {
      return;
    }
    if (outcome.status === "failed") {
      throw outcome.error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// --- Tests --------------------------------------------------------------------

describe("dispatchOutboxBatch (core.md §6)", () => {
  it("materializes one delivery row per registered consumer and marks the event dispatched", async () => {
    const { eventId } = await placeOrder(randomUUID());

    const result = await dispatch();

    expect(result.claimedEvents).toBe(1);
    expect(result.createdDeliveries).toBe(2);
    for (const consumer of [
      "deliveryFixtureChat.card-updater",
      "deliveryFixtureBilling.order-registrar",
    ]) {
      const row = await deliveryRow(consumer, eventId);
      expect(row?.status).toBe("pending");
      expect(row?.attempts).toBe(0);
      expect(row?.nextAttemptAt).not.toBeNull();
      expect(row?.processedAt).toBeNull();
    }
    const [event] = await database.runtime.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, eventId));
    expect(event?.dispatchedAt).not.toBeNull();
    expect(event?.claimedAt).not.toBeNull();
    expect(event?.claimedBy).toBe("test-dispatcher");
  });

  it("marks consumer-less events dispatched with zero delivery rows", async () => {
    const { eventId } = await placeOrder(randomUUID(), "noted");

    const result = await dispatch();

    expect(result.claimedEvents).toBe(1);
    expect(result.createdDeliveries).toBe(0);
    const rows = await database.runtime.db
      .select()
      .from(eventDeliveries)
      .where(eq(eventDeliveries.eventId, eventId));
    expect(rows).toHaveLength(0);
    const [event] = await database.runtime.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, eventId));
    expect(event?.dispatchedAt).not.toBeNull();
  });

  it("finds nothing once the backlog is drained", async () => {
    await dispatch();
    expect(await dispatch()).toEqual({
      claimedEvents: 0,
      createdDeliveries: 0,
    });
    const undispatched = await database.runtime.db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(isNull(domainEvents.dispatchedAt));
    expect(undispatched).toHaveLength(0);
  });

  it("keeps existing delivery rows (and their status) on redispatch", async () => {
    const { eventId } = await placeOrder(randomUUID());
    await dispatch();
    await driveToProcessed(cardSubscription, eventId);
    // Drain the card event the consumer emitted, so the backlog is empty.
    await dispatch();

    // Simulate a redispatch of the same event (e.g. after claim recovery).
    await database.runtime.db
      .update(domainEvents)
      .set({ dispatchedAt: null, claimedAt: null, claimedBy: null })
      .where(eq(domainEvents.id, eventId));
    const result = await dispatch();

    expect(result.claimedEvents).toBe(1);
    // Both (consumer, eventId) rows already exist — nothing is created.
    expect(result.createdDeliveries).toBe(0);
    const processed = await deliveryRow(
      "deliveryFixtureChat.card-updater",
      eventId,
    );
    expect(processed?.status).toBe("processed");
  });
});

describe("executeDelivery — the delivery entrypoint (core.md §6)", () => {
  it("runs the bound action on the validated envelope with an event-scoped system context", async () => {
    const orderId = randomUUID();
    const { eventId, request } = await placeOrder(orderId);
    await dispatch();

    const outcome = await executeDelivery(deps(), {
      subscription: cardSubscription,
      eventId,
    });

    expect(outcome).toEqual({ status: "processed" });
    const row = await deliveryRow("deliveryFixtureChat.card-updater", eventId);
    expect(row?.status).toBe("processed");
    expect(row?.processedAt).not.toBeNull();

    const run = cardRuns.find((entry) => entry.envelope.eventId === eventId);
    expect(run).toBeDefined();
    // The envelope, exactly as core.md §6 defines it — JSON-safe.
    expect(run?.envelope.name).toBe("deliveryFixture.orderPlaced");
    expect(run?.envelope.version).toBe(1);
    expect(run?.envelope.companyId).toBe(companyA);
    expect(run?.envelope.aggregate).toEqual({
      type: "order",
      id: orderId,
      sequence: "1",
    });
    expect(run?.envelope.actor).toEqual({
      type: "user",
      id: anna,
      channel: "ui",
    });
    expect(run?.envelope.requestId).toBe(request.requestId);
    expect(run?.envelope.correlationId).toBe(request.correlationId);
    expect(typeof run?.envelope.occurredAt).toBe("string");
    expect(run?.envelope.payload).toEqual({ orderId });

    // The system context is scoped to the event's company; the consumer id
    // is the accountable service name (core.md §6).
    expect(run?.ctx.scope).toBe("tenant");
    expect(run?.ctx.companyId).toBe(companyA);
    expect(run?.ctx.serviceName).toBe("deliveryFixtureChat.card-updater");
    expect(run?.ctx.correlationId).toBe(request.correlationId);

    // The consumer's own emission commits with the delivery and chains
    // causation to the delivered event.
    const [emitted] = await emittedCardEvents(orderId);
    expect(emitted?.causationId).toBe(eventId);
    expect(emitted?.correlationId).toBe(request.correlationId);
    expect(emitted?.actorType).toBe("system");
    expect(emitted?.actorId).toBe("deliveryFixtureChat.card-updater");
    expect(emitted?.channel).toBe("system");
    expect(emitted?.companyId).toBe(companyA);
  });

  it("treats a redelivery as a no-op", async () => {
    const orderId = randomUUID();
    const { eventId } = await placeOrder(orderId);
    await dispatch();
    await driveToProcessed(cardSubscription, eventId);
    const runsBefore = cardRuns.length;

    const outcome = await executeDelivery(deps(), {
      subscription: cardSubscription,
      eventId,
    });

    expect(outcome).toEqual({ status: "alreadyProcessed" });
    expect(cardRuns.length).toBe(runsBefore);
    expect(await emittedCardEvents(orderId)).toHaveLength(1);
  });

  it("commits effects, audit, and the processed transition atomically — and rolls all back on failure", async () => {
    const orderId = randomUUID();
    const { eventId } = await placeOrder(orderId);
    await dispatch();

    failCardFor.add(eventId);
    const failed = await executeDelivery(deps(true), {
      subscription: cardSubscription,
      eventId,
    });
    failCardFor.delete(eventId);

    expect(failed.status).toBe("failed");
    if (failed.status === "failed") {
      expect(failed.error).toBeInstanceOf(ConflictError);
    }
    // Rollback left the delivery pending and removed every same-tx write:
    // the consumer's emitted event and its success audit row.
    const row = await deliveryRow("deliveryFixtureChat.card-updater", eventId);
    expect(row?.status).toBe("pending");
    expect(row?.processedAt).toBeNull();
    expect(await emittedCardEvents(orderId)).toHaveLength(0);
    const auditRows = await database.runtime.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "deliveryFixtureChat.upsertCard"));
    expect(auditRows.filter((r) => r.outcome === "ok")).toHaveLength(0);
    // The failure record commits in its own transaction (core.md §8).
    expect(auditRows.filter((r) => r.outcome === "CONFLICT")).toHaveLength(1);

    // The pending delivery is retryable: the next attempt commits
    // everything together.
    const retried = await executeDelivery(deps(true), {
      subscription: cardSubscription,
      eventId,
    });
    expect(retried).toEqual({ status: "processed" });
    expect(await emittedCardEvents(orderId)).toHaveLength(1);
    const okRows = await database.runtime.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "deliveryFixtureChat.upsertCard"));
    const ok = okRows.filter((r) => r.outcome === "ok");
    expect(ok).toHaveLength(1);
    expect(ok[0]?.actorType).toBe("system");
    expect(ok[0]?.actorId).toBe("deliveryFixtureChat.card-updater");
    expect(ok[0]?.companyId).toBe(companyA);
  });

  it("defers a later delivery until the aggregate's earlier one is processed", async () => {
    const orderId = randomUUID();
    const first = await placeOrder(orderId);
    const second = await placeOrder(orderId);
    await dispatch();

    expect(
      await executeDelivery(deps(), {
        subscription: cardSubscription,
        eventId: second.eventId,
      }),
    ).toEqual({ status: "deferred" });
    expect(
      await executeDelivery(deps(), {
        subscription: cardSubscription,
        eventId: first.eventId,
      }),
    ).toEqual({ status: "processed" });
    expect(
      await executeDelivery(deps(), {
        subscription: cardSubscription,
        eventId: second.eventId,
      }),
    ).toEqual({ status: "processed" });

    const sequences = cardRuns
      .filter((run) => run.envelope.payload.orderId === orderId)
      .map((run) => run.envelope.aggregate.sequence);
    expect(sequences).toEqual(["1", "2"]);
  });

  it("holds per-aggregate ordering under concurrent executors", async () => {
    const orderId = randomUUID();
    const first = await placeOrder(orderId);
    const second = await placeOrder(orderId);
    await dispatch();

    await Promise.all([
      driveToProcessed(cardSubscription, second.eventId),
      driveToProcessed(cardSubscription, first.eventId),
    ]);

    const sequences = cardRuns
      .filter((run) => run.envelope.payload.orderId === orderId)
      .map((run) => run.envelope.aggregate.sequence);
    expect(sequences).toEqual(["1", "2"]);
  });

  it("does not block one consumer on another consumer's failure", async () => {
    const orderId = randomUUID();
    const { eventId } = await placeOrder(orderId);
    await dispatch();

    failBillingFor.add(eventId);
    const billing = await executeDelivery(deps(), {
      subscription: billingSubscription,
      eventId,
    });
    failBillingFor.delete(eventId);
    const chat = await executeDelivery(deps(), {
      subscription: cardSubscription,
      eventId,
    });

    expect(billing.status).toBe("failed");
    expect(chat).toEqual({ status: "processed" });
    const billingRow = await deliveryRow(
      "deliveryFixtureBilling.order-registrar",
      eventId,
    );
    expect(billingRow?.status).toBe("pending");
  });

  it("delivers global events with a global system context and a null company", async () => {
    const request = requestMeta();
    await executeAction(deps(), {
      action: sweepAction,
      input: {},
      request: { ...request, channel: "system" },
      principal: {
        mode: "system",
        serviceName: "delivery-fixture-sweeper",
        scope: { scope: "global" },
      },
    });
    const [event] = await database.runtime.db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(eq(domainEvents.requestId, request.requestId));
    if (event === undefined) throw new Error("sweep event not emitted");
    await dispatch();

    const outcome = await executeDelivery(deps(), {
      subscription: sweepSubscription,
      eventId: event.id,
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(sweepCtx?.scope).toBe("global");
    expect(sweepCtx?.companyId).toBeUndefined();
    expect(sweepCtx?.serviceName).toBe("deliveryFixtureOps.sweep-recorder");
  });

  it("fails as an invariant when the delivery was never materialized", async () => {
    const outcome = await executeDelivery(deps(), {
      subscription: cardSubscription,
      eventId: randomUUID(),
    });

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.error).toBeInstanceOf(CoreInvariantError);
    }
  });
});
