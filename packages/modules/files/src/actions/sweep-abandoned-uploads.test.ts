import { describe, expect, it } from "vitest";

import {
  ABANDONED_PENDING_TTL_MS,
  sweepAbandonedUploadsContract,
  sweepAbandonedUploadsInputSchema,
  sweepAbandonedUploadsOutputSchema,
} from "./sweep-abandoned-uploads.contract.js";

describe("files.sweepAbandonedUploads contract", () => {
  it("is a tenant system write, internal, audited, and idempotent", () => {
    expect(sweepAbandonedUploadsContract.name).toBe(
      "files.sweepAbandonedUploads",
    );
    expect(sweepAbandonedUploadsContract.principal).toBe("system");
    expect(sweepAbandonedUploadsContract.systemScope).toBe("tenant");
    expect(sweepAbandonedUploadsContract.transport).toBe("internal");
    expect(sweepAbandonedUploadsContract.risk).toBe("write");
    expect(sweepAbandonedUploadsContract.permissions).toEqual([]);
    expect(sweepAbandonedUploadsContract.aiExposure).toBe("internal");
    expect(sweepAbandonedUploadsContract.audit).toBe(true);
    expect(sweepAbandonedUploadsContract.idempotent).toBe(true);
    expect(sweepAbandonedUploadsContract.emits).toEqual([]);
    expect(sweepAbandonedUploadsContract.timeout).toBe(15_000);
    expect(ABANDONED_PENDING_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("accepts only a fileId and never returns a URL or object key", () => {
    expect(
      Object.keys(sweepAbandonedUploadsInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(sweepAbandonedUploadsOutputSchema.shape).toSorted(),
    ).toEqual([
      "deletedCatalog",
      "deletedPendingRow",
      "deletedStaging",
      "fileId",
    ]);
  });
});
