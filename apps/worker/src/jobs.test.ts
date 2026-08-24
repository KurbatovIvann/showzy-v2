import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { drainSweepBatches, type SweepTickResult } from "./jobs.js";
import {
  BULLMQ_PREFIX,
  CLEANUP_INTERVAL_MS,
  IDEMPOTENCY_CLEANUP_JOB_NAME,
  MAINTENANCE_JOB_ATTEMPTS,
  MAINTENANCE_JOB_BACKOFF_MS,
  MAINTENANCE_LOCK_DURATION_MS,
  MAINTENANCE_QUEUE_NAME,
  MAINTENANCE_SERVICE_NAME,
  SWEEP_ABANDONED_UPLOADS_JOB_NAME,
  SWEEP_BATCH_SIZE,
  SWEEP_INTERVAL_MS,
  SWEEP_MAX_BATCHES_PER_TICK,
} from "./policy.js";

describe("BullMQ job host policy (fnd-T29 / SHO-120)", () => {
  it("pins the showzy prefix, one maintenance queue, cleanup and sweep intervals", () => {
    expect(BULLMQ_PREFIX).toBe("showzy");
    expect(MAINTENANCE_QUEUE_NAME).toBe("maintenance");
    expect(IDEMPOTENCY_CLEANUP_JOB_NAME).toBe("cleanupExpiredIdempotencyKeys");
    expect(SWEEP_ABANDONED_UPLOADS_JOB_NAME).toBe("sweepAbandonedUploads");
    expect(MAINTENANCE_SERVICE_NAME).toBe("worker.maintenance");
    expect(CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1_000);
    expect(SWEEP_INTERVAL_MS).toBe(5 * 60 * 1_000);
    expect(MAINTENANCE_LOCK_DURATION_MS).toBe(60_000);
  });

  it("pins the sweep drain and retry knobs", () => {
    // Matches the files.sweepAbandonedUploads input ceiling; a larger
    // value fails input validation loudly on the first tick.
    expect(SWEEP_BATCH_SIZE).toBe(20);
    expect(SWEEP_MAX_BATCHES_PER_TICK).toBe(25);
    expect(MAINTENANCE_JOB_ATTEMPTS).toBe(3);
    expect(MAINTENANCE_JOB_BACKOFF_MS).toBe(5_000);
  });

  it("drains full sweep batches within one tick and stops on the first partial batch", async () => {
    const batchIndexes: number[] = [];
    const results: SweepTickResult[] = [
      { leftoverStagingDeleted: 5, abandonedPendingDeleted: 15 },
      { leftoverStagingDeleted: 0, abandonedPendingDeleted: 20 },
      { leftoverStagingDeleted: 1, abandonedPendingDeleted: 2 },
    ];
    const drained = await drainSweepBatches({
      runBatch: (batchIndex) => {
        batchIndexes.push(batchIndex);
        const result = results[batchIndex];
        if (result === undefined) {
          throw new Error("drained past the prepared batches");
        }
        return Promise.resolve(result);
      },
      batchSize: 20,
      maxBatches: 25,
    });

    expect(batchIndexes).toEqual([0, 1, 2]);
    expect(drained).toEqual({
      leftoverStagingDeleted: 6,
      abandonedPendingDeleted: 37,
      batches: 3,
    });
  });

  it("stops at the per-tick batch cap even while batches stay full", async () => {
    let calls = 0;
    const drained = await drainSweepBatches({
      runBatch: () => {
        calls += 1;
        return Promise.resolve({
          leftoverStagingDeleted: 0,
          abandonedPendingDeleted: 20,
        });
      },
      batchSize: 20,
      maxBatches: 3,
    });

    expect(calls).toBe(3);
    expect(drained.batches).toBe(3);
    expect(drained.abandonedPendingDeleted).toBe(60);
  });

  it("runs exactly one batch when the first batch is already partial", async () => {
    let calls = 0;
    const drained = await drainSweepBatches({
      runBatch: () => {
        calls += 1;
        return Promise.resolve({
          leftoverStagingDeleted: 0,
          abandonedPendingDeleted: 0,
        });
      },
      batchSize: 20,
      maxBatches: 25,
    });

    expect(calls).toBe(1);
    expect(drained).toEqual({
      leftoverStagingDeleted: 0,
      abandonedPendingDeleted: 0,
      batches: 1,
    });
  });

  it("binds and probes the files object store at worker boot, then closes it", () => {
    const bootSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "boot.ts"),
      "utf8",
    );
    expect(bootSource).toContain('from "@showzy/files/storage"');
    expect(bootSource).toContain("configureFilesObjectStore");
    expect(bootSource).toContain("probeFilesObjectStore");
    expect(bootSource).toContain("closeFilesObjectStore");
    expect(bootSource).not.toMatch(/setInterval\s*\(/);
  });
});
