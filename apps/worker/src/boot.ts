/**
 * Process boot: load validated config, open Postgres + Redis, compose
 * the action pipeline, LISTEN on the outbox channel, start the loop.
 */
import { randomUUID } from "node:crypto";

import type { ServerConfig } from "@showzy/config";
import { createDbClient } from "@showzy/db";
import { Redis } from "ioredis";
import { pino } from "pino";

import { createOutboxListener } from "./listen.js";
import { createOutboxWorker, type WorkerLoop } from "./loop.js";
import { createActionPipeline } from "./pipeline.js";
import {
  createRedisConfirmationStore,
  createRedisRateLimitStore,
} from "./stores/redis.js";
import { workerSubscriptions } from "./subscriptions.js";

export interface BootedWorker {
  readonly loop: WorkerLoop;
  close(): Promise<void>;
}

export async function bootWorker(config: ServerConfig): Promise<BootedWorker> {
  const db = createDbClient({ databaseUrl: config.database.url });
  const redis = new Redis(config.redis.url);
  await redis.ping();
  const logger = pino({ name: "worker" });
  const workerId = randomUUID();
  const pipeline = createActionPipeline({
    db: db.db,
    logger,
    rateLimitStore: createRedisRateLimitStore(redis),
    confirmationStore: createRedisConfirmationStore(redis),
    ipHmacSecret: config.rateLimit.ipHmacSecret,
  });
  const loop = createOutboxWorker({
    db: db.db,
    pipeline,
    subscriptions: workerSubscriptions,
    workerId,
    logger,
    listen: createOutboxListener({
      connectionString: config.database.url,
      logger,
    }),
  });
  await loop.start();
  return {
    loop,
    async close() {
      await loop.stop();
      await redis.quit();
      await db.pool.end();
    },
  };
}
