/**
 * Process boot: load validated config, bind the files object store, open
 * Postgres + Redis, compose the action pipeline, start the BullMQ job
 * host, LISTEN on the outbox channel, start the loop.
 */
import { randomUUID } from "node:crypto";

import type { ServerConfig } from "@showzy/config";
import { createDbClient } from "@showzy/db";
import {
  closeFilesObjectStore,
  configureFilesObjectStore,
  probeFilesObjectStore,
} from "@showzy/files/storage";
import { Redis } from "ioredis";
import type { Logger } from "pino";

import { createJobHost, type JobHost } from "./jobs.js";
import { createOutboxListener } from "./listen.js";
import { createOutboxWorker, type WorkerLoop } from "./loop.js";
import { createProcessObservability } from "./observability.js";
import { createActionPipeline } from "./pipeline.js";
import {
  createRedisConfirmationStore,
  createRedisRateLimitStore,
} from "./stores/redis.js";
import { workerSubscriptions } from "./subscriptions.js";

export interface BootedWorker {
  readonly loop: WorkerLoop;
  readonly jobs: JobHost;
  close(): Promise<void>;
}

export interface BootWorkerOptions {
  readonly logger?: Logger;
  readonly workerId?: string;
  readonly pollIntervalMs?: number;
  readonly cleanupIntervalMs?: number;
  readonly sweepIntervalMs?: number;
  readonly now?: () => number;
}

export async function bootWorker(
  config: ServerConfig,
  options: BootWorkerOptions = {},
): Promise<BootedWorker> {
  configureFilesObjectStore(config.s3);
  try {
    await probeFilesObjectStore();
  } catch (error) {
    closeFilesObjectStore();
    throw error;
  }
  const db = createDbClient({ databaseUrl: config.database.url });
  const redis = new Redis(config.redis.url);
  await redis.ping();
  const { logger: processLogger, telemetry } = createProcessObservability({
    name: "worker",
    sentryDsn: config.sentry.dsn,
  });
  const logger = options.logger ?? processLogger;
  const workerId = options.workerId ?? randomUUID();
  const pipeline = createActionPipeline({
    db: db.db,
    logger,
    telemetry,
    rateLimitStore: createRedisRateLimitStore(redis),
    confirmationStore: createRedisConfirmationStore(redis),
    ipHmacSecret: config.rateLimit.ipHmacSecret,
  });
  const jobHostOptions = {
    redisUrl: config.redis.url,
    db: db.db,
    logger,
    workerId,
    pipeline,
    ...(options.cleanupIntervalMs !== undefined
      ? { cleanupIntervalMs: options.cleanupIntervalMs }
      : {}),
    ...(options.sweepIntervalMs !== undefined
      ? { sweepIntervalMs: options.sweepIntervalMs }
      : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  };
  const jobs = createJobHost(jobHostOptions);
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
    ...(options.pollIntervalMs !== undefined
      ? { pollIntervalMs: options.pollIntervalMs }
      : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  await jobs.start();
  await loop.start();
  return {
    loop,
    jobs,
    async close() {
      await jobs.close();
      await loop.stop();
      closeFilesObjectStore();
      await redis.quit();
      await db.pool.end();
    },
  };
}
