import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
