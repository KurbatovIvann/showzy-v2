/**
 * BullMQ job host (fnd-T29, ADR-0007). One dedicated Redis connection
 * (`maxRetriesPerRequest: null`), prefix `showzy`, queue `maintenance`.
 * Processors stay thin: this proving job calls the core cleanup library.
 * Domain event delivery stays on the outbox loop (ADR-0012).
 */
import { cleanupExpiredIdempotencyKeys } from "@showzy/core";
import type { Database } from "@showzy/db";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";

import {
  BULLMQ_PREFIX,
  CLEANUP_INTERVAL_MS,
  IDEMPOTENCY_CLEANUP_JOB_NAME,
  MAINTENANCE_QUEUE_NAME,
} from "./policy.js";

export interface JobHost {
  start(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateJobHostOptions {
  readonly redisUrl: string;
  readonly db: Database;
  readonly logger: Logger;
  readonly workerId: string;
  readonly cleanupIntervalMs?: number;
  readonly now?: () => number;
  /** Test seam to observe or gate a tick; production omits this. */
  cleanup?: () => Promise<number>;
}

type MaintenanceJob = Job<Record<string, never>, number>;

export function createJobHost(options: CreateJobHostOptions): JobHost {
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const intervalMs = options.cleanupIntervalMs ?? CLEANUP_INTERVAL_MS;
  const runCleanup =
    options.cleanup ??
    (() =>
      options.now === undefined
        ? cleanupExpiredIdempotencyKeys(options.db)
        : cleanupExpiredIdempotencyKeys(options.db, options.now));

  async function processMaintenanceJob(job: MaintenanceJob): Promise<number> {
    if (job.name !== IDEMPOTENCY_CLEANUP_JOB_NAME) {
      options.logger.error(
        {
          worker_id: options.workerId,
          job_name: job.name,
          job_id: job.id,
        },
        "unknown maintenance job",
      );
      return 0;
    }
    const removed = await runCleanup();
    if (removed > 0) {
      options.logger.info(
        { worker_id: options.workerId, removed_keys: removed },
        "expired idempotency keys cleaned",
      );
    }
    return removed;
  }

  let queue: Queue | undefined;
  let worker: Worker<Record<string, never>, number> | undefined;
  let started = false;
  let closed = false;

  return {
    async start() {
      if (started || closed) {
        return;
      }
      await connection.ping();
      queue = new Queue(MAINTENANCE_QUEUE_NAME, {
        connection,
        prefix: BULLMQ_PREFIX,
      });
      worker = new Worker(MAINTENANCE_QUEUE_NAME, processMaintenanceJob, {
        connection,
        prefix: BULLMQ_PREFIX,
        concurrency: 1,
      });
      worker.on("error", (error) => {
        options.logger.error(
          { err: error, worker_id: options.workerId },
          "maintenance worker error",
        );
      });
      worker.on("failed", (job, error) => {
        options.logger.error(
          {
            err: error,
            worker_id: options.workerId,
            job_id: job?.id,
            job_name: job?.name,
          },
          "maintenance job failed",
        );
      });
      await queue.upsertJobScheduler(
        IDEMPOTENCY_CLEANUP_JOB_NAME,
        { every: intervalMs },
        {
          name: IDEMPOTENCY_CLEANUP_JOB_NAME,
          data: {},
          opts: {
            removeOnComplete: true,
            removeOnFail: 50,
          },
        },
      );
      await worker.waitUntilReady();
      started = true;
      options.logger.info(
        {
          worker_id: options.workerId,
          queue: MAINTENANCE_QUEUE_NAME,
          prefix: BULLMQ_PREFIX,
          cleanup_interval_ms: intervalMs,
        },
        "maintenance job host started",
      );
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      if (worker !== undefined) {
        await worker.close();
      }
      if (queue !== undefined) {
        await queue.close();
      }
      await connection.quit();
    },
  };
}
