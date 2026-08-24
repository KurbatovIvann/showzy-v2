/**
 * BullMQ job host (fnd-T29, ADR-0007 / SHO-120). One dedicated Redis
 * connection (`maxRetriesPerRequest: null`), prefix `showzy`, queue
 * `maintenance`. Processors stay thin: idempotency cleanup calls the core
 * library; abandoned-upload GC invokes the registered system action.
 * Domain event delivery stays on the outbox loop (ADR-0012).
 */
import { randomUUID } from "node:crypto";

import {
  cleanupExpiredIdempotencyKeys,
  executeAction,
  type ActionPipelineDeps,
} from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import type { Database } from "@showzy/db";
import { sweepAbandonedUploads } from "@showzy/files";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";

import {
  BULLMQ_PREFIX,
  CLEANUP_INTERVAL_MS,
  IDEMPOTENCY_CLEANUP_JOB_NAME,
  MAINTENANCE_LOCK_DURATION_MS,
  MAINTENANCE_QUEUE_NAME,
  MAINTENANCE_SERVICE_NAME,
  SWEEP_ABANDONED_UPLOADS_JOB_NAME,
  SWEEP_INTERVAL_MS,
} from "./policy.js";

export interface SweepTickResult {
  readonly leftoverStagingDeleted: number;
  readonly abandonedPendingDeleted: number;
}

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
  readonly sweepIntervalMs?: number;
  readonly now?: () => number;
  /**
   * Required for the default sweep path (`files.sweepAbandonedUploads`).
   * Tests that stub `sweep` may omit it.
   */
  readonly pipeline?: ActionPipelineDeps;
  /** Test seam to observe or gate a tick; production omits this. */
  cleanup?: () => Promise<number>;
  /** Test seam to observe or gate a sweep tick; production omits this. */
  sweep?: () => Promise<SweepTickResult>;
}

type MaintenanceJob = Job<Record<string, never>, number>;

export function createJobHost(options: CreateJobHostOptions): JobHost {
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const cleanupIntervalMs = options.cleanupIntervalMs ?? CLEANUP_INTERVAL_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  const runCleanup =
    options.cleanup ??
    (() =>
      options.now === undefined
        ? cleanupExpiredIdempotencyKeys(options.db)
        : cleanupExpiredIdempotencyKeys(options.db, options.now));

  async function runSweep(job: MaintenanceJob): Promise<SweepTickResult> {
    if (options.sweep !== undefined) {
      return options.sweep();
    }
    if (options.pipeline === undefined) {
      throw new CoreInvariantError(
        "files.sweepAbandonedUploads requires the worker action pipeline",
      );
    }
    return executeAction(options.pipeline, {
      action: sweepAbandonedUploads,
      input: {},
      request: {
        requestId: randomUUID(),
        correlationId: randomUUID(),
        channel: "system",
        idempotencyKey: job.id ?? randomUUID(),
      },
      principal: {
        mode: "system",
        serviceName: MAINTENANCE_SERVICE_NAME,
        scope: { scope: "global" },
      },
    });
  }

  async function processMaintenanceJob(job: MaintenanceJob): Promise<number> {
    switch (job.name) {
      case IDEMPOTENCY_CLEANUP_JOB_NAME: {
        const removed = await runCleanup();
        if (removed > 0) {
          options.logger.info(
            { worker_id: options.workerId, removed_keys: removed },
            "expired idempotency keys cleaned",
          );
        }
        return removed;
      }
      case SWEEP_ABANDONED_UPLOADS_JOB_NAME: {
        const swept = await runSweep(job);
        options.logger.info(
          {
            worker_id: options.workerId,
            leftover_staging_deleted: swept.leftoverStagingDeleted,
            abandoned_pending_deleted: swept.abandonedPendingDeleted,
          },
          "abandoned uploads swept",
        );
        return swept.leftoverStagingDeleted + swept.abandonedPendingDeleted;
      }
      default: {
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
    }
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
        lockDuration: MAINTENANCE_LOCK_DURATION_MS,
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
        { every: cleanupIntervalMs },
        {
          name: IDEMPOTENCY_CLEANUP_JOB_NAME,
          data: {},
          opts: {
            removeOnComplete: true,
            removeOnFail: 50,
          },
        },
      );
      await queue.upsertJobScheduler(
        SWEEP_ABANDONED_UPLOADS_JOB_NAME,
        { every: sweepIntervalMs },
        {
          name: SWEEP_ABANDONED_UPLOADS_JOB_NAME,
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
          cleanup_interval_ms: cleanupIntervalMs,
          sweep_interval_ms: sweepIntervalMs,
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
