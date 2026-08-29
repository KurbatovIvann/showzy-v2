/**
 * BullMQ job host (fnd-T29, ADR-0007 / SHO-120 / SHO-236). One dedicated
 * Redis connection (`maxRetriesPerRequest: null`), prefix `showzy`,
 * queues `maintenance` and `pdf`. Processors stay thin: idempotency
 * cleanup calls the core library; abandoned-upload GC and PDF render
 * invoke registered system actions. Domain event delivery stays on the
 * outbox loop (ADR-0012).
 */
import { randomUUID } from "node:crypto";

import {
  cleanupExpiredIdempotencyKeys,
  executeAction,
  type ActionPipelineDeps,
} from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import type { Database } from "@showzy/db";
import { renderPdf } from "@showzy/doc-generation";
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
  PDF_JOB_NAME,
  PDF_LOCK_DURATION_MS,
  PDF_QUEUE_NAME,
  PDF_SERVICE_NAME,
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
   * Required for the default sweep path (`files.sweepAbandonedUploads`)
   * and the pdf processor (`docGeneration.renderPdf`). Tests that stub
   * `sweep` and never enqueue pdf jobs may omit it.
   */
  readonly pipeline?: ActionPipelineDeps;
  /** Test seam to observe or gate a tick; production omits this. */
  cleanup?: () => Promise<number>;
  /** Test seam to observe or gate a sweep tick; production omits this. */
  sweep?: () => Promise<SweepTickResult>;
}

type MaintenanceJob = Job<Record<string, never>, number>;
type PdfJob = Job<Record<string, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

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

  async function processPdfJob(job: PdfJob): Promise<unknown> {
    if (job.name !== PDF_JOB_NAME) {
      options.logger.error(
        {
          worker_id: options.workerId,
          job_name: job.name,
          job_id: job.id,
        },
        "unknown pdf job",
      );
      return {};
    }
    if (options.pipeline === undefined) {
      throw new CoreInvariantError(
        "docGeneration.renderPdf requires the worker action pipeline",
      );
    }
    const data = isRecord(job.data) ? job.data : {};
    const companyId = readNonEmptyString(data, "companyId");
    if (companyId === undefined) {
      throw new CoreInvariantError("pdf job is missing tenant companyId");
    }
    return executeAction(options.pipeline, {
      action: renderPdf,
      input: job.data,
      request: {
        requestId: readNonEmptyString(data, "requestId") ?? randomUUID(),
        correlationId:
          readNonEmptyString(data, "correlationId") ?? randomUUID(),
        channel: "system",
        idempotencyKey: job.id ?? randomUUID(),
      },
      principal: {
        mode: "system",
        serviceName: PDF_SERVICE_NAME,
        scope: { scope: "tenant", companyId },
      },
    });
  }

  let queue: Queue | undefined;
  let worker: Worker<Record<string, never>, number> | undefined;
  let pdfQueue: Queue | undefined;
  let pdfWorker: Worker<Record<string, unknown>> | undefined;
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
      pdfQueue = new Queue(PDF_QUEUE_NAME, {
        connection,
        prefix: BULLMQ_PREFIX,
      });
      pdfWorker = new Worker(PDF_QUEUE_NAME, processPdfJob, {
        connection,
        prefix: BULLMQ_PREFIX,
        concurrency: 1,
        lockDuration: PDF_LOCK_DURATION_MS,
      });
      pdfWorker.on("error", (error) => {
        options.logger.error(
          { err: error, worker_id: options.workerId },
          "pdf worker error",
        );
      });
      pdfWorker.on("failed", (job, error) => {
        options.logger.error(
          {
            err: error,
            worker_id: options.workerId,
            job_id: job?.id,
            job_name: job?.name,
          },
          "pdf job failed",
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
      await pdfWorker.waitUntilReady();
      started = true;
      options.logger.info(
        {
          worker_id: options.workerId,
          queue: MAINTENANCE_QUEUE_NAME,
          pdf_queue: PDF_QUEUE_NAME,
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
      if (pdfWorker !== undefined) {
        await pdfWorker.close();
      }
      if (worker !== undefined) {
        await worker.close();
      }
      if (pdfQueue !== undefined) {
        await pdfQueue.close();
      }
      if (queue !== undefined) {
        await queue.close();
      }
      await connection.quit();
    },
  };
}
