/**
 * Integration tests for the event delivery core (fnd-T17/T18 — core.md §6)
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
 * - Due discovery, exponential backoff, five-attempt dead-letter parking,
 *   alerting, stale-claim takeover, lost-claim deferral, and
 *   consumer-scoped replay (one event or every dead row for a consumer).
 */
import { randomUUID } from "node:crypto";

import {
  auditLog,
  companies,
  companyMembers,
  domainEvents,
  eventDeliveries,
  idempotencyKeys,
  type ReadTx,
  type Tx,
} from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { createTestDatabase, type TestDatabase } from "@showzy/db/testing";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { pino, type Logger } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { defineActionContract } from "../../contract/define-action-contract.js";
import { ConflictError, CoreInvariantError } from "../../errors/index.js";
import { createAuditHook } from "../audit/create-audit-hook.js";
import type { SystemCtx } from "../context/types.js";
import { createIdempotencyHook } from "../idempotency/create-idempotency-hook.js";
import { implementAction } from "../implement-action.js";
import { executeAction } from "../pipeline/execute-action.js";
import type {
  ActionPipelineDeps,
  ActionTransactionRunner,
  PipelineRequestMeta,
} from "../pipeline/types.js";
import { defineEvent } from "./define-event.js";
import { defineEventHandler } from "./define-event-handler.js";
import {
  DELIVERY_CLAIM_MARGIN_MS,
  DELIVERY_RETRY_BASE_MS,
  dispatchOutboxBatch,
  executeDelivery,
  findClaimableDeliveries,
  type DeliveryOutcome,
} from "./delivery.js";
import { eventEnvelopeSchema, type EventEnvelope } from "./envelope.js";
import { runDeliveryReplayCli } from "./replay-dead-deliveries.cli.js";
import { replayDeadDeliveries } from "./replay-dead-deliveries.js";

let database: TestDatabase;

const anna = "user_anna_delivery";
const companyA = randomUUID();
const testWorker = "delivery-test-worker";
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

function deps(
  overrides: Pick<Partial<ActionPipelineDeps>, "logger" | "now"> = {},
): ActionPipelineDeps {
  return {
    db: database.runtime.db,
    logger: overrides.logger ?? silentLogger,
    ...(overrides.now === undefined ? {} : { now: overrides.now }),
    hooks: {
      rateLimit: { enforce: () => Promise.resolve() },
      audit: createAuditHook({ db: database.runtime.db }),
    },
  };
}

function captureLogger(): {
  readonly logger: Logger;
  readonly entries: () => Record<string, unknown>[];
} {
  const lines: string[] = [];
  const logger = pino(
    { base: null },
    {
      write(chunk: string) {
        lines.push(chunk);
      },
    },
  );
  return {
    logger,
    entries: () =>
      lines.map((line) => JSON.parse(line) as Record<string, unknown>),
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
      claimedBy: testWorker,
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

    const outcome = await executeDelivery(
      {
        ...deps(),
        hooks: {
          ...deps().hooks,
          // Passed so the test can prove the delivery entrypoint replaces
          // this slot — the delivery row is the reservation (core.md §6).
          idempotency: createIdempotencyHook({ db: database.runtime.db }),
        },
      },
      {
        subscription: cardSubscription,
        eventId,
        claimedBy: testWorker,
      },
    );

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

    // The delivery row is the reservation — no second idempotency_keys row
    // (core.md §6).
    const keys = await database.runtime.db
      .select({ key: idempotencyKeys.key })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, eventId));
    expect(keys).toHaveLength(0);
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
      claimedBy: testWorker,
    });

    expect(outcome).toEqual({ status: "alreadyProcessed" });
    expect(cardRuns.length).toBe(runsBefore);
    expect(await emittedCardEvents(orderId)).toHaveLength(1);
  });

  it("commits effects, audit, and the processed transition atomically — and rolls all back on failure", async () => {
    const orderId = randomUUID();
    const { eventId } = await placeOrder(orderId);
    await dispatch();
    let now = Date.now();
    const withAudit = () => deps({ now: () => now });

    const auditCounts = async () => {
      const rows = await database.runtime.db
        .select({ outcome: auditLog.outcome })
        .from(auditLog)
        .where(eq(auditLog.action, "deliveryFixtureChat.upsertCard"));
      return {
        ok: rows.filter((row) => row.outcome === "ok").length,
        conflict: rows.filter((row) => row.outcome === "CONFLICT").length,
      };
    };
    const beforeFail = await auditCounts();

    failCardFor.add(eventId);
    const failed = await executeDelivery(withAudit(), {
      subscription: cardSubscription,
      eventId,
      claimedBy: testWorker,
    });
    failCardFor.delete(eventId);

    expect(failed.status).toBe("failed");
    if (failed.status === "failed") {
      expect(failed.error).toBeInstanceOf(ConflictError);
      expect(failed.retryAt).toBe(
        new Date(now + DELIVERY_RETRY_BASE_MS).toISOString(),
      );
    }
    // Rollback left the delivery pending and removed every same-tx write:
    // the consumer's emitted event and its success audit row.
    const row = await deliveryRow("deliveryFixtureChat.card-updater", eventId);
    expect(row?.status).toBe("pending");
    expect(row?.processedAt).toBeNull();
    expect(await emittedCardEvents(orderId)).toHaveLength(0);
    const afterFail = await auditCounts();
    expect(afterFail.ok).toBe(beforeFail.ok);
    // The failure record commits in its own transaction (core.md §8).
    expect(afterFail.conflict).toBe(beforeFail.conflict + 1);

    // The pending delivery is retryable: the next attempt commits
    // everything together.
    now += DELIVERY_RETRY_BASE_MS;
    const retried = await executeDelivery(withAudit(), {
      subscription: cardSubscription,
      eventId,
      claimedBy: testWorker,
    });
    expect(retried).toEqual({ status: "processed" });
    expect(await emittedCardEvents(orderId)).toHaveLength(1);
    const afterRetry = await auditCounts();
    expect(afterRetry.ok).toBe(beforeFail.ok + 1);
    const latestOk = await database.runtime.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "deliveryFixtureChat.upsertCard"),
          eq(auditLog.outcome, "ok"),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(latestOk[0]?.actorType).toBe("system");
    expect(latestOk[0]?.actorId).toBe("deliveryFixtureChat.card-updater");
    expect(latestOk[0]?.companyId).toBe(companyA);
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
        claimedBy: testWorker,
      }),
    ).toEqual({ status: "deferred" });
    expect(
      await executeDelivery(deps(), {
        subscription: cardSubscription,
        eventId: first.eventId,
        claimedBy: testWorker,
      }),
    ).toEqual({ status: "processed" });
    expect(
      await executeDelivery(deps(), {
        subscription: cardSubscription,
        eventId: second.eventId,
        claimedBy: testWorker,
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
      claimedBy: testWorker,
    });
    failBillingFor.delete(eventId);
    const chat = await executeDelivery(deps(), {
      subscription: cardSubscription,
      eventId,
      claimedBy: testWorker,
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
      claimedBy: testWorker,
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
      claimedBy: testWorker,
    });

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.error).toBeInstanceOf(CoreInvariantError);
    }
  });
});

describe("delivery retry, dead-letter, claim recovery, and replay (core.md §6)", () => {
  it("backs off exponentially, parks after five failures, isolates consumers, and replays exactly once", async () => {
    const orderId = randomUUID();
    const { eventId } = await placeOrder(orderId);
    await dispatch();
    let now = Date.now();
    const captured = captureLogger();
    const runtime = () => deps({ logger: captured.logger, now: () => now });

    failCardFor.add(eventId);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const outcome = await executeDelivery(runtime(), {
        subscription: cardSubscription,
        eventId,
        claimedBy: testWorker,
      });
      expect(outcome.status).toBe("failed");

      const row = await deliveryRow(
        "deliveryFixtureChat.card-updater",
        eventId,
      );
      expect(row?.attempts).toBe(attempt);
      expect(row?.lastError).toBe("CONFLICT: Injected consumer failure.");
      expect(row?.claimedAt).toBeNull();
      expect(row?.claimedBy).toBeNull();

      if (attempt < 5) {
        const expectedDelay = DELIVERY_RETRY_BASE_MS * 2 ** (attempt - 1);
        const expectedRetryAt = new Date(now + expectedDelay);
        expect(row?.status).toBe("pending");
        expect(row?.nextAttemptAt).toEqual(expectedRetryAt);
        if (outcome.status === "failed") {
          expect(outcome.retryAt).toBe(expectedRetryAt.toISOString());
        }
        expect(
          await executeDelivery(runtime(), {
            subscription: cardSubscription,
            eventId,
            claimedBy: "delivery-early-worker",
          }),
        ).toEqual({ status: "deferred" });
        expect(
          await findClaimableDeliveries(
            { db: database.runtime.db },
            { subscriptions: [cardSubscription], now: () => now },
          ),
        ).not.toContainEqual({
          consumer: cardSubscription.consumer,
          eventId,
        });
        now += expectedDelay;
        expect(
          await findClaimableDeliveries(
            { db: database.runtime.db },
            { subscriptions: [cardSubscription], now: () => now },
          ),
        ).toContainEqual({
          consumer: cardSubscription.consumer,
          eventId,
        });
      } else {
        expect(row?.status).toBe("dead");
        expect(row?.nextAttemptAt).toBeNull();
        if (outcome.status === "failed") {
          expect(outcome.retryAt).toBeNull();
        }
        expect(
          await findClaimableDeliveries(
            { db: database.runtime.db },
            { subscriptions: [cardSubscription], now: () => now },
          ),
        ).not.toContainEqual({
          consumer: cardSubscription.consumer,
          eventId,
        });
      }
    }
    failCardFor.delete(eventId);

    expect(
      captured
        .entries()
        .filter((entry) => entry["msg"] === "event delivery dead-lettered"),
    ).toEqual([
      expect.objectContaining({
        consumer: "deliveryFixtureChat.card-updater",
        event_id: eventId,
        attempts: 5,
        error_code: "CONFLICT",
      }),
    ]);

    // Parking is per consumer: billing processes the same event while chat
    // remains dead.
    expect(
      await executeDelivery(runtime(), {
        subscription: billingSubscription,
        eventId,
        claimedBy: testWorker,
      }),
    ).toEqual({ status: "processed" });
    expect(
      (await deliveryRow("deliveryFixtureBilling.order-registrar", eventId))
        ?.status,
    ).toBe("processed");
    expect(
      (await deliveryRow("deliveryFixtureChat.card-updater", eventId))?.status,
    ).toBe("dead");

    const replayed = await replayDeadDeliveries(
      { db: database.runtime.db, now: () => now },
      { consumer: "deliveryFixtureChat.card-updater", eventId },
    );
    expect(replayed).toEqual({ replayed: 1 });
    const replayedRow = await deliveryRow(
      "deliveryFixtureChat.card-updater",
      eventId,
    );
    expect(replayedRow).toMatchObject({
      status: "pending",
      attempts: 0,
      claimedAt: null,
      claimedBy: null,
      lastError: null,
      processedAt: null,
    });
    expect(replayedRow?.nextAttemptAt).toEqual(new Date(now));
    // Repeating the admin command is an idempotent no-op.
    expect(
      await replayDeadDeliveries(
        { db: database.runtime.db, now: () => now },
        { consumer: "deliveryFixtureChat.card-updater", eventId },
      ),
    ).toEqual({ replayed: 0 });

    expect(
      await executeDelivery(runtime(), {
        subscription: cardSubscription,
        eventId,
        claimedBy: testWorker,
      }),
    ).toEqual({ status: "processed" });
    const runsAfterReplay = cardRuns.filter(
      (run) => run.envelope.eventId === eventId,
    ).length;
    expect(
      await executeDelivery(runtime(), {
        subscription: cardSubscription,
        eventId,
        claimedBy: "delivery-redelivery-worker",
      }),
    ).toEqual({ status: "alreadyProcessed" });
    expect(
      cardRuns.filter((run) => run.envelope.eventId === eventId),
    ).toHaveLength(runsAfterReplay);
    expect(await emittedCardEvents(orderId)).toHaveLength(1);
  });

  it("keeps a live claim with its owner and reclaims it after the action-timeout lease", async () => {
    const { eventId } = await placeOrder(randomUUID());
    await dispatch();
    let now = Date.now();

    await database.runtime.db
      .update(eventDeliveries)
      .set({
        status: "processing",
        attempts: 1,
        nextAttemptAt: null,
        claimedAt: new Date(now),
        claimedBy: "delivery-crashed-worker",
      })
      .where(
        and(
          eq(eventDeliveries.consumer, cardSubscription.consumer),
          eq(eventDeliveries.eventId, eventId),
        ),
      );

    expect(
      await executeDelivery(deps({ now: () => now }), {
        subscription: cardSubscription,
        eventId,
        claimedBy: "delivery-recovery-worker",
      }),
    ).toEqual({ status: "deferred" });
    expect(
      await findClaimableDeliveries(
        { db: database.runtime.db },
        { subscriptions: [cardSubscription], now: () => now },
      ),
    ).not.toContainEqual({
      consumer: cardSubscription.consumer,
      eventId,
    });
    expect(
      (await deliveryRow("deliveryFixtureChat.card-updater", eventId))
        ?.claimedBy,
    ).toBe("delivery-crashed-worker");

    now += cardSubscription.contract.timeout + DELIVERY_CLAIM_MARGIN_MS;
    expect(
      await findClaimableDeliveries(
        { db: database.runtime.db },
        { subscriptions: [cardSubscription], now: () => now },
      ),
    ).toContainEqual({
      consumer: cardSubscription.consumer,
      eventId,
    });
    expect(
      await executeDelivery(deps({ now: () => now }), {
        subscription: cardSubscription,
        eventId,
        claimedBy: "delivery-recovery-worker",
      }),
    ).toEqual({ status: "processed" });
    const recovered = await deliveryRow(
      "deliveryFixtureChat.card-updater",
      eventId,
    );
    expect(recovered?.status).toBe("processed");
    expect(recovered?.attempts).toBe(2);
    expect(recovered?.claimedAt).toBeNull();
    expect(recovered?.claimedBy).toBeNull();
  });

  it("defers without overwriting when another worker takes the claim before execution", async () => {
    const { eventId } = await placeOrder(randomUUID());
    await dispatch();
    const thief = "delivery-thief-worker";
    const db = stealClaimAfter({
      after: "claim",
      consumer: cardSubscription.consumer,
      eventId,
      claimedBy: thief,
    });

    await expect(
      executeDelivery(
        { ...deps(), db },
        {
          subscription: cardSubscription,
          eventId,
          claimedBy: testWorker,
        },
      ),
    ).resolves.toEqual({ status: "deferred" });

    const row = await deliveryRow("deliveryFixtureChat.card-updater", eventId);
    expect(row?.status).toBe("processing");
    expect(row?.claimedBy).toBe(thief);
    expect(row?.lastError).toBeNull();
  });

  it("defers a stale failure record when the lease was taken over mid-attempt", async () => {
    const { eventId } = await placeOrder(randomUUID());
    await dispatch();
    const thief = "delivery-thief-worker";
    failCardFor.add(eventId);
    const db = stealClaimAfter({
      after: "failed-execute",
      consumer: cardSubscription.consumer,
      eventId,
      claimedBy: thief,
    });

    await expect(
      executeDelivery(
        { ...deps(), db },
        {
          subscription: cardSubscription,
          eventId,
          claimedBy: testWorker,
        },
      ),
    ).resolves.toEqual({ status: "deferred" });
    failCardFor.delete(eventId);

    const row = await deliveryRow("deliveryFixtureChat.card-updater", eventId);
    expect(row?.status).toBe("processing");
    expect(row?.claimedBy).toBe(thief);
    expect(row?.lastError).toBeNull();
  });

  it("replays every dead row for one consumer and leaves other consumers parked", async () => {
    const first = await placeOrder(randomUUID());
    const second = await placeOrder(randomUUID());
    await dispatch();
    const now = Date.now();
    await database.runtime.db
      .update(eventDeliveries)
      .set({
        status: "dead",
        attempts: 5,
        nextAttemptAt: null,
        lastError: "CONFLICT: parked for replay.",
      })
      .where(inArray(eventDeliveries.eventId, [first.eventId, second.eventId]));

    const captured = captureLogger();
    await expect(
      runDeliveryReplayCli(
        {
          db: database.runtime.db,
          logger: captured.logger,
          now: () => now,
        },
        ["--consumer", "deliveryFixtureChat.card-updater"],
      ),
    ).resolves.toEqual({ replayed: 2 });

    for (const eventId of [first.eventId, second.eventId]) {
      expect(
        await deliveryRow("deliveryFixtureChat.card-updater", eventId),
      ).toMatchObject({
        status: "pending",
        attempts: 0,
        lastError: null,
      });
      expect(
        (await deliveryRow("deliveryFixtureBilling.order-registrar", eventId))
          ?.status,
      ).toBe("dead");
    }
    expect(
      captured
        .entries()
        .filter((entry) => entry["msg"] === "dead event deliveries replayed"),
    ).toEqual([
      expect.objectContaining({
        consumer: "deliveryFixtureChat.card-updater",
        event_id: null,
        replayed: 2,
      }),
    ]);
  });
});

/** Commits a foreign claim after a named executor transaction. */
function stealClaimAfter(options: {
  readonly after: "claim" | "failed-execute";
  readonly consumer: string;
  readonly eventId: string;
  readonly claimedBy: string;
}): ActionTransactionRunner {
  let phase: "claim" | "execute" | "done" = "claim";
  const steal = async () => {
    await database.runtime.db
      .update(eventDeliveries)
      .set({
        status: "processing",
        claimedAt: new Date(),
        claimedBy: options.claimedBy,
      })
      .where(
        and(
          eq(eventDeliveries.consumer, options.consumer),
          eq(eventDeliveries.eventId, options.eventId),
        ),
      );
  };
  return {
    transaction: (async (
      fn: Parameters<ActionTransactionRunner["transaction"]>[0],
    ) => {
      try {
        const result = await database.runtime.db.transaction(fn);
        if (options.after === "claim" && phase === "claim") {
          phase = "done";
          await steal();
        } else if (phase === "claim") {
          phase = "execute";
        }
        return result;
      } catch (error) {
        if (options.after === "failed-execute" && phase === "execute") {
          phase = "done";
          await steal();
        }
        throw error;
      }
    }) as ActionTransactionRunner["transaction"],
  };
}
