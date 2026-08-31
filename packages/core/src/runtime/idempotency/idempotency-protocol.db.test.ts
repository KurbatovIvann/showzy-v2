/**
 * Integration tests for the idempotency protocol (fnd-T15 — core.md §5)
 * against the shared Testcontainers harness.
 *
 * Verifies:
 * - A missing key on an idempotent mutation is a `ValidationError` — never
 *   generated server-side; the handler does not run.
 * - Replay returns the stored response snapshot without re-running the
 *   handler; the snapshot commits atomically with the handler's effects.
 * - Same key + different payload → `IdempotencyConflictError`.
 * - Principal scoping: one staff member cannot replay another's result.
 * - Concurrent double-submit runs the handler exactly once (live lease →
 *   `ConcurrentRetryError` with a retry-after hint).
 * - A failed attempt marks the key `failed`; a retry takes it over.
 * - A crashed attempt's expired lease is taken over by exactly one retry.
 * - Replay after the 48-h retention re-executes; cleanup removes expired
 *   keys only.
 */
import { randomUUID } from "node:crypto";

import {
  companies,
  companyMembers,
  idempotencyKeys,
  rolePermissionDefaults,
} from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { createTestDatabase, type TestDatabase } from "@showzy/db/testing";
import {
  createParityFixtureTables,
  fixtureProducts,
} from "@showzy/db/testing/fixtures";
import { and, eq } from "drizzle-orm";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { defineActionContract } from "../../contract/define-action-contract.js";
import {
  ConcurrentRetryError,
  ConflictError,
  CoreInvariantError,
  IdempotencyConflictError,
  ValidationError,
} from "../../errors/index.js";
import { createAuditHook } from "../audit/create-audit-hook.js";
import {
  implementAction,
  type ImplementedAction,
} from "../implement-action.js";
import { executeAction } from "../pipeline/execute-action.js";
import type {
  ActionPipelineDeps,
  IdempotencyHook,
  PipelineRequestMeta,
  RateLimitHook,
} from "../pipeline/types.js";
import {
  cleanupExpiredIdempotencyKeys,
  createIdempotencyHook,
  IDEMPOTENCY_LEASE_MARGIN_MS,
  IDEMPOTENCY_RETENTION_MS,
} from "./create-idempotency-hook.js";

let database: TestDatabase;

const users = {
  anna: "user_anna_idem",
  boris: "user_boris_idem",
} as const;
const companyA = randomUUID();

const silentLogger = pino({ enabled: false });

beforeAll(async () => {
  database = await createTestDatabase();
  await database.runtime.db.insert(user).values([
    { id: users.anna, name: "Anna", email: "anna-idem@example.test" },
    { id: users.boris, name: "Boris", email: "boris-idem@example.test" },
  ]);
  await database.runtime.db
    .insert(companies)
    .values([{ id: companyA, name: "Idem Co", slug: "idem-co", prefix: "ID" }]);
  await database.runtime.db
    .insert(rolePermissionDefaults)
    .values([{ role: "owner", permission: "idemFixture:write" }]);
  // Both users hold the same permission: replay isolation in the tests below
  // must come from the principal key, never from a permission difference.
  await database.runtime.db.insert(companyMembers).values(
    Object.values(users).map((userId) => ({
      companyId: companyA,
      userId,
      role: "owner" as const,
      permissions: { granted: [], denied: [] },
    })),
  );
  await createParityFixtureTables(database.admin);
});

afterAll(async () => {
  await database.close();
});

// --- Fixtures -----------------------------------------------------------------

const contract = defineActionContract({
  transport: "internal",
  aiExposure: "internal",
  requiresConfirmation: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  name: "idemFixture.createNote",
  description: "Idempotent write fixture.",
  principal: "staff",
  input: z.object({ note: z.string() }),
  output: z.object({ resultId: z.uuid() }),
  permissions: ["idemFixture:write"],
  risk: "write",
  idempotent: true,
  audit: true,
  timeout: 5_000,
});

type FixtureAction = ImplementedAction<
  typeof contract.input,
  typeof contract.output
>;

/** A counting handler returning a fresh id per real execution. */
function countingAction(): { action: FixtureAction; runs: () => number } {
  let runs = 0;
  const action = implementAction(contract, {
    handler: () => {
      runs += 1;
      return Promise.resolve({ resultId: randomUUID() });
    },
    auditTarget: () => ({ type: "note", id: "fixture" }),
  });
  return { action, runs: () => runs };
}

function deps(hook?: IdempotencyHook): ActionPipelineDeps {
  const rateLimit: RateLimitHook = { enforce: () => Promise.resolve() };
  return {
    db: database.runtime.db,
    logger: silentLogger,
    hooks: {
      rateLimit,
      audit: createAuditHook({ db: database.runtime.db, logger: silentLogger }),
      idempotency: hook ?? createIdempotencyHook({ db: database.runtime.db }),
    },
  };
}

function requestMeta(
  overrides: Partial<PipelineRequestMeta> = {},
): PipelineRequestMeta {
  return {
    requestId: randomUUID(),
    correlationId: randomUUID(),
    channel: "ui",
    ...overrides,
  };
}

interface RunOptions {
  readonly key?: string;
  readonly userId?: string;
  readonly note?: string;
  readonly hook?: IdempotencyHook;
}

function run(
  action: FixtureAction,
  options: RunOptions = {},
): Promise<{ resultId: string }> {
  return executeAction(deps(options.hook), {
    action,
    input: { note: options.note ?? "hello" },
    request: requestMeta(
      options.key !== undefined ? { idempotencyKey: options.key } : {},
    ),
    principal: {
      mode: "staff",
      session: { userId: options.userId ?? users.anna },
      companySelector: companyA,
    },
  });
}

async function rowsForKey(
  key: string,
): Promise<(typeof idempotencyKeys.$inferSelect)[]> {
  return database.runtime.db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.action, contract.name),
        eq(idempotencyKeys.key, key),
      ),
    );
}

/** A hook whose storage clock is shifted into the past by `ms`. */
function shiftedHook(ms: number): IdempotencyHook {
  return createIdempotencyHook({
    db: database.runtime.db,
    now: () => Date.now() - ms,
  });
}

// --- Tests --------------------------------------------------------------------

describe("idempotency protocol — key requirement (core.md §5)", () => {
  it("rejects a missing key with ValidationError before the handler runs", async () => {
    const { action, runs } = countingAction();

    await expect(run(action)).rejects.toThrow(ValidationError);

    expect(runs()).toBe(0);
  });
});

describe("idempotency protocol — replay and conflicts", () => {
  it("replays the stored response without re-running the handler", async () => {
    const { action, runs } = countingAction();
    const key = randomUUID();

    const first = await run(action, { key });
    const second = await run(action, { key });

    expect(second.resultId).toBe(first.resultId);
    expect(runs()).toBe(1);

    const [row] = await rowsForKey(key);
    expect(row?.status).toBe("completed");
    expect(row?.response).toEqual({ resultId: first.resultId });
    expect(row?.principalKey).toBe(`staff:${users.anna}`);
    expect(row?.scopeKey).toBe(`company:${companyA}`);
    expect(row?.companyId).toBe(companyA);
  });

  it("rejects the same key with a different payload", async () => {
    const { action, runs } = countingAction();
    const key = randomUUID();

    await run(action, { key, note: "original" });
    await expect(run(action, { key, note: "changed" })).rejects.toThrow(
      IdempotencyConflictError,
    );

    expect(runs()).toBe(1);
  });

  it("scopes replay to the accountable principal — one staff member cannot replay another's result", async () => {
    const { action, runs } = countingAction();
    const key = randomUUID();

    const annas = await run(action, { key, userId: users.anna });
    const borises = await run(action, { key, userId: users.boris });

    expect(borises.resultId).not.toBe(annas.resultId);
    expect(runs()).toBe(2);

    const rows = await rowsForKey(key);
    expect(rows.map((row) => row.principalKey).sort()).toEqual([
      `staff:${users.anna}`,
      `staff:${users.boris}`,
    ]);
  });
});

describe("idempotency protocol — concurrency and leases", () => {
  it("runs the handler exactly once on a concurrent double-submit", async () => {
    let releaseHandler = (): void => {};
    const gate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    let signalStarted = (): void => {};
    const handlerStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    let runs = 0;
    const action = implementAction(contract, {
      handler: async () => {
        signalStarted();
        await gate;
        runs += 1;
        return { resultId: randomUUID() };
      },
      auditTarget: () => ({ type: "note", id: "fixture" }),
    });
    const key = randomUUID();

    const winner = run(action, { key });
    await handlerStarted;
    const loser = await run(action, { key }).then(
      () => undefined,
      (error: unknown) => error,
    );
    releaseHandler();
    await winner;

    expect(loser).toBeInstanceOf(ConcurrentRetryError);
    expect((loser as ConcurrentRetryError).retryAfterSec).toBeGreaterThan(0);
    expect(runs).toBe(1);
  });

  it("marks a failed attempt `failed`; a retry takes the key over and completes", async () => {
    let failFirst = true;
    let runs = 0;
    const action = implementAction(contract, {
      handler: () => {
        runs += 1;
        if (failFirst) {
          failFirst = false;
          return Promise.reject(new ConflictError("First attempt fails."));
        }
        return Promise.resolve({ resultId: randomUUID() });
      },
      auditTarget: () => ({ type: "note", id: "fixture" }),
    });
    const key = randomUUID();

    await expect(run(action, { key })).rejects.toThrow(ConflictError);
    const [failedRow] = await rowsForKey(key);
    expect(failedRow?.status).toBe("failed");
    expect(failedRow?.response).toBeNull();

    const retried = await run(action, { key });
    expect(runs).toBe(2);
    const [completedRow] = await rowsForKey(key);
    expect(completedRow?.status).toBe("completed");
    expect(completedRow?.response).toEqual({ resultId: retried.resultId });
    // The takeover swapped attempt ownership (core.md §5 lease takeover).
    expect(completedRow?.attemptId).not.toBe(failedRow?.attemptId);
  });

  it("lets exactly one retry take over a crashed attempt's expired lease", async () => {
    const key = randomUUID();
    // Simulate a crash: a reservation whose lease has long expired and whose
    // attempt never finalized or failed — exactly what a dead process leaves.
    const staleHook = shiftedHook(
      contract.timeout + IDEMPOTENCY_LEASE_MARGIN_MS + 60_000,
    );
    const reserved = await staleHook.reserve({
      contract,
      request: {
        action: contract.name,
        ...requestMeta({ idempotencyKey: key }),
      },
      principal: {
        mode: "staff",
        session: { userId: users.anna },
        companySelector: companyA,
      },
      input: { note: "hello" },
      authorization: {
        actor: { type: "user", id: users.anna },
        companyId: companyA,
      },
      confirmationGrant: undefined,
    });
    expect(reserved.kind).toBe("execute");
    const [staleRow] = await rowsForKey(key);
    expect(staleRow?.status).toBe("in_progress");
    expect(staleRow?.leaseExpiresAt.getTime()).toBeLessThan(Date.now());

    let releaseHandler = (): void => {};
    const gate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    let runs = 0;
    const action = implementAction(contract, {
      handler: async () => {
        await gate;
        runs += 1;
        return { resultId: randomUUID() };
      },
      auditTarget: () => ({ type: "note", id: "fixture" }),
    });

    const attempts = [run(action, { key }), run(action, { key })];
    // Both retries race for the conditional takeover; the loser fails fast.
    const settledLoser = await Promise.race(
      attempts.map((attempt) =>
        attempt.then(
          () => undefined,
          (error: unknown) => error,
        ),
      ),
    );
    releaseHandler();
    const outcomes = await Promise.allSettled(attempts);

    expect(settledLoser).toBeInstanceOf(ConcurrentRetryError);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(runs).toBe(1);
    const [finalRow] = await rowsForKey(key);
    expect(finalRow?.status).toBe("completed");
  });
});

describe("idempotency protocol — atomicity", () => {
  it("commits the response snapshot atomically with handler effects", async () => {
    const productId = randomUUID();
    const action = implementAction(contract, {
      handler: async (_input, ctx) => {
        if (ctx.principal !== "staff" || !("insert" in ctx.db)) {
          throw new CoreInvariantError("fixture expects a writable staff tx");
        }
        await ctx.db.insert(fixtureProducts).values({
          id: productId,
          companyId: ctx.companyId,
          name: "Idem fixture",
          published: false,
        });
        // Fails output validation → CoreInvariantError → full rollback.
        return { resultId: "not-a-uuid" };
      },
      auditTarget: () => ({ type: "note", id: "fixture" }),
    });
    const key = randomUUID();

    await expect(run(action, { key })).rejects.toThrow(CoreInvariantError);

    const products = await database.runtime.db
      .select()
      .from(fixtureProducts)
      .where(eq(fixtureProducts.id, productId));
    expect(products).toHaveLength(0);
    // The handler effect rolled back — and so did the `completed` snapshot;
    // the failure marking ran in its own transaction afterwards.
    const [row] = await rowsForKey(key);
    expect(row?.status).toBe("failed");
    expect(row?.response).toBeNull();
  });
});

describe("idempotency protocol — retention (48 h)", () => {
  it("re-executes when the stored key has expired", async () => {
    const { action, runs } = countingAction();
    const key = randomUUID();

    // First attempt through a clock 49 h in the past: its retention window
    // has already closed by real time.
    const first = await run(action, {
      key,
      hook: shiftedHook(IDEMPOTENCY_RETENTION_MS + 60 * 60 * 1000),
    });
    const second = await run(action, { key });

    expect(second.resultId).not.toBe(first.resultId);
    expect(runs()).toBe(2);
    const [row] = await rowsForKey(key);
    expect(row?.status).toBe("completed");
    expect(row?.response).toEqual({ resultId: second.resultId });
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("cleanup removes expired keys only", async () => {
    const { action } = countingAction();
    const expiredKey = randomUUID();
    const liveKey = randomUUID();
    await run(action, {
      key: expiredKey,
      hook: shiftedHook(IDEMPOTENCY_RETENTION_MS + 60 * 60 * 1000),
    });
    await run(action, { key: liveKey });

    const removed = await cleanupExpiredIdempotencyKeys(database.runtime.db);

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await rowsForKey(expiredKey)).toHaveLength(0);
    expect(await rowsForKey(liveKey)).toHaveLength(1);
  });
});
