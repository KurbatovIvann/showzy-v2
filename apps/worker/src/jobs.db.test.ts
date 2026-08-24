/**
 * BullMQ job host (fnd-T29): maintenance scheduler tick, single-flight
 * across replicas, drain on shutdown, log hygiene, re-upsert after flush.
 */
import { randomUUID } from "node:crypto";

import { createProcessLogger, loadServerConfig } from "@showzy/config";
import { createTestKit, type TestKit } from "@showzy/core/testing";
import { idempotencyKeys } from "@showzy/db";
import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import { Queue } from "bullmq";
import { inArray } from "drizzle-orm";
import { Redis } from "ioredis";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bootWorker } from "./boot.js";
import { createJobHost } from "./jobs.js";
import {
  BULLMQ_PREFIX,
  IDEMPOTENCY_CLEANUP_JOB_NAME,
  MAINTENANCE_QUEUE_NAME,
} from "./policy.js";
import { createProcessShutdown } from "./shutdown.js";

const silent = pino({ enabled: false });
const REDIS_PASSWORD = "REDIS_TICK_SECRET";
const TICK_INTERVAL_MS = 400;
const SINGLE_FLIGHT_INTERVAL_MS = 5_000;

let kit: TestKit;
let redisContainer: StartedRedisContainer;
let redisUrl: string;

beforeAll(async () => {
  kit = await createTestKit();
  redisContainer = await new RedisContainer("redis:8-alpine")
    .withPassword(REDIS_PASSWORD)
    .start();
  redisUrl = redisContainer.getConnectionUrl();
});

afterAll(async () => {
  await kit.db.close();
  await redisContainer.stop();
});

async function flushRedis(): Promise<void> {
  const admin = new Redis(redisUrl);
  await admin.flushdb();
  await admin.quit();
}

beforeEach(async () => {
  await flushRedis();
});

function runtimeConnectionString(): string {
  const connectionString = kit.db.runtime.pool.options.connectionString;
  if (connectionString === undefined || connectionString === "") {
    throw new Error("runtime pool is missing a connection string");
  }
  return connectionString;
}

function testConfig() {
  return loadServerConfig({
    NODE_ENV: "test",
    DATABASE_URL: runtimeConnectionString(),
    REDIS_URL: redisUrl,
    S3_ENDPOINT: "http://localhost:3900",
    S3_ACCESS_KEY_ID: "showzy-local",
    S3_SECRET_ACCESS_KEY: "showzy-local-secret",
    S3_FORCE_PATH_STYLE: "true",
    S3_BUCKET: "showzy",
    BETTER_AUTH_SECRET: "dev-only-secret-change-me-0000000000",
    BETTER_AUTH_URL: "http://localhost:3000",
    IP_HMAC_SECRET: "dev-only-ip-hmac-secret-change-me-00",
  });
}

async function waitUntil(
  check: () => Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const started = Date.now();
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for job-host condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function withMaintenanceQueue<T>(
  run: (queue: Queue) => Promise<T>,
): Promise<T> {
  const connection = new Redis(redisUrl);
  const queue = new Queue(MAINTENANCE_QUEUE_NAME, {
    connection,
    prefix: BULLMQ_PREFIX,
  });
  try {
    return await run(queue);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

async function insertKeyPair(): Promise<{
  expiredKey: string;
  liveKey: string;
}> {
  const expiredKey = randomUUID();
  const liveKey = randomUUID();
  const nowMs = Date.now();
  const action = `workerJobs.cleanup.${randomUUID()}`;
  await kit.db.runtime.db.insert(idempotencyKeys).values([
    {
      principalKey: `staff:${kit.identities.users.anna}`,
      scopeKey: `company:${kit.identities.companies.a}`,
      companyId: kit.identities.companies.a,
      action,
      key: expiredKey,
      requestHash: "c".repeat(64),
      status: "completed",
      attemptId: randomUUID(),
      leaseExpiresAt: new Date(nowMs),
      expiresAt: new Date(nowMs - 1_000),
    },
    {
      principalKey: `staff:${kit.identities.users.anna}`,
      scopeKey: `company:${kit.identities.companies.a}`,
      companyId: kit.identities.companies.a,
      action,
      key: liveKey,
      requestHash: "d".repeat(64),
      status: "completed",
      attemptId: randomUUID(),
      leaseExpiresAt: new Date(nowMs + 30_000),
      expiresAt: new Date(nowMs + 48 * 3_600_000),
    },
  ]);
  return { expiredKey, liveKey };
}

async function remainingKeys(
  keys: readonly string[],
): Promise<readonly string[]> {
  const rows = await kit.db.runtime.db
    .select({ key: idempotencyKeys.key })
    .from(idempotencyKeys)
    .where(inArray(idempotencyKeys.key, [...keys]));
  return rows.map((row) => row.key);
}

describe("apps/worker BullMQ job host (fnd-T29)", () => {
  it("boots, registers the maintenance scheduler, and a tick deletes expired keys only", async () => {
    const { expiredKey, liveKey } = await insertKeyPair();
    const booted = await bootWorker(testConfig(), {
      logger: silent,
      pollIntervalMs: 60_000,
      cleanupIntervalMs: TICK_INTERVAL_MS,
    });
    try {
      const schedulers = await withMaintenanceQueue((queue) =>
        queue.getJobSchedulers(),
      );
      expect(schedulers).toHaveLength(1);
      expect(schedulers[0]?.name).toBe(IDEMPOTENCY_CLEANUP_JOB_NAME);
      expect(schedulers[0]?.every).toBe(TICK_INTERVAL_MS);

      await waitUntil(async () => {
        const remaining = await remainingKeys([expiredKey, liveKey]);
        return remaining.length === 1 && remaining[0] === liveKey;
      });
      expect(await remainingKeys([expiredKey, liveKey])).toEqual([liveKey]);
    } finally {
      await booted.close();
    }
  });

  it("processes a given scheduled tick once across two hosts sharing Redis", async () => {
    let runs = 0;
    const hostA = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger: silent,
      workerId: "jobs-replica-a",
      cleanupIntervalMs: SINGLE_FLIGHT_INTERVAL_MS,
      cleanup: () => {
        runs += 1;
        return Promise.resolve(0);
      },
    });
    const hostB = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger: silent,
      workerId: "jobs-replica-b",
      cleanupIntervalMs: SINGLE_FLIGHT_INTERVAL_MS,
      cleanup: () => {
        runs += 1;
        return Promise.resolve(0);
      },
    });
    await hostA.start();
    await hostB.start();
    try {
      const schedulers = await withMaintenanceQueue((queue) =>
        queue.getJobSchedulers(),
      );
      expect(schedulers).toHaveLength(1);
      await waitUntil(() => Promise.resolve(runs >= 1), 15_000);
      await hostA.close();
      await hostB.close();
      await new Promise((resolve) => setTimeout(resolve, TICK_INTERVAL_MS * 2));
      expect(runs).toBe(1);
    } finally {
      await hostA.close();
      await hostB.close();
    }
  });

  it("drains an in-flight maintenance job then ignores a second shutdown", async () => {
    let release: (() => void) | undefined;
    let entered = false;
    const host = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger: silent,
      workerId: "jobs-drain",
      cleanupIntervalMs: 60_000,
      cleanup: () => {
        entered = true;
        return new Promise((resolve) => {
          release = () => {
            resolve(0);
          };
        });
      },
    });
    await host.start();
    let closes = 0;
    const shutdown = createProcessShutdown({
      logger: silent,
      close: () => {
        closes += 1;
        return host.close();
      },
      flush: () => Promise.resolve(),
    });
    try {
      await withMaintenanceQueue((queue) =>
        queue.add(IDEMPOTENCY_CLEANUP_JOB_NAME, {}),
      );
      await waitUntil(() => Promise.resolve(entered));
      const first = shutdown.run();
      const second = shutdown.run();
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(closes).toBe(1);
      if (release === undefined) {
        throw new Error("expected an in-flight maintenance job");
      }
      release();
      await Promise.all([first, second]);
      expect(closes).toBe(1);
    } finally {
      if (release !== undefined) {
        release();
      }
      await shutdown.run();
    }
  });

  it("does not write secrets or the Redis URL in tick logs", async () => {
    const lines: string[] = [];
    const logger = createProcessLogger({
      name: "worker-jobs-logs",
      destination: {
        write(chunk: string) {
          lines.push(chunk);
        },
      },
    });
    const { expiredKey, liveKey } = await insertKeyPair();
    const host = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger,
      workerId: "jobs-logs",
      cleanupIntervalMs: TICK_INTERVAL_MS,
    });
    await host.start();
    try {
      await waitUntil(async () => {
        const remaining = await remainingKeys([expiredKey, liveKey]);
        return remaining.length === 1 && remaining[0] === liveKey;
      });
      const payload = lines.join("\n");
      expect(payload).toContain("expired idempotency keys cleaned");
      expect(payload).not.toContain(REDIS_PASSWORD);
      expect(payload).not.toContain(redisUrl);
    } finally {
      await host.close();
    }
  });

  it("re-upserts the scheduler after flushing BullMQ keys so the next tick still runs", async () => {
    const first = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger: silent,
      workerId: "jobs-flush-1",
      cleanupIntervalMs: TICK_INTERVAL_MS,
    });
    await first.start();
    await waitUntil(async () => {
      const schedulers = await withMaintenanceQueue((queue) =>
        queue.getJobSchedulers(),
      );
      return schedulers.length === 1;
    });
    await first.close();

    const admin = new Redis(redisUrl);
    await admin.flushdb();
    await admin.quit();

    const afterFlush = await withMaintenanceQueue((queue) =>
      queue.getJobSchedulers(),
    );
    expect(afterFlush).toHaveLength(0);

    const { expiredKey, liveKey } = await insertKeyPair();
    const second = createJobHost({
      redisUrl,
      db: kit.db.runtime.db,
      logger: silent,
      workerId: "jobs-flush-2",
      cleanupIntervalMs: TICK_INTERVAL_MS,
    });
    await second.start();
    try {
      const restored = await withMaintenanceQueue((queue) =>
        queue.getJobSchedulers(),
      );
      expect(restored).toHaveLength(1);
      expect(restored[0]?.name).toBe(IDEMPOTENCY_CLEANUP_JOB_NAME);
      await waitUntil(async () => {
        const remaining = await remainingKeys([expiredKey, liveKey]);
        return remaining.length === 1 && remaining[0] === liveKey;
      });
    } finally {
      await second.close();
    }
  });
});
