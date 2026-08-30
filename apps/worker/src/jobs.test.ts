import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS,
  BACKFILL_CATALOG_RENDITIONS_JOB_NAME,
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

describe("BullMQ job host policy (fnd-T29 / SHO-120 / SHO-236 / SHO-248)", () => {
  it("pins the showzy prefix, maintenance and pdf queues, cleanup, sweep, and backfill intervals", () => {
    expect(BULLMQ_PREFIX).toBe("showzy");
    expect(MAINTENANCE_QUEUE_NAME).toBe("maintenance");
    expect(PDF_QUEUE_NAME).toBe("pdf");
    expect(PDF_JOB_NAME).toBe("renderPdf");
    expect(PDF_SERVICE_NAME).toBe("worker.pdf");
    expect(IDEMPOTENCY_CLEANUP_JOB_NAME).toBe("cleanupExpiredIdempotencyKeys");
    expect(SWEEP_ABANDONED_UPLOADS_JOB_NAME).toBe("sweepAbandonedUploads");
    expect(BACKFILL_CATALOG_RENDITIONS_JOB_NAME).toBe(
      "backfillCatalogRenditions",
    );
    expect(MAINTENANCE_SERVICE_NAME).toBe("worker.maintenance");
    expect(CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1_000);
    expect(SWEEP_INTERVAL_MS).toBe(5 * 60 * 1_000);
    expect(BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS).toBe(5 * 60 * 1_000);
    expect(MAINTENANCE_LOCK_DURATION_MS).toBe(60_000);
    expect(PDF_LOCK_DURATION_MS).toBe(60_000);
  });

  it("keeps the files inspect-slot interval equal to the worker scheduler", () => {
    const filesBackfill = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../packages/modules/files/src/services/backfill-catalog-renditions.ts",
      ),
      "utf8",
    );
    expect(filesBackfill).toContain(
      "BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS = 5 * 60 * 1_000",
    );
    expect(BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS).toBe(5 * 60 * 1_000);
  });

  it("pdf processor is executeAction(renderPdf) with no domain SQL", () => {
    const jobsSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "jobs.ts"),
      "utf8",
    );
    expect(jobsSource).toContain("executeAction");
    expect(jobsSource).toContain("renderPdf");
    expect(jobsSource).toContain("PDF_QUEUE_NAME");
    expect(jobsSource).not.toContain("documentGenerationJobs");
    expect(jobsSource).not.toContain("@showzy/db/schema/");
    expect(jobsSource).not.toContain("drizzle-orm");
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
