import { describe, expect, it } from "vitest";

import {
  ABANDONED_PENDING_TTL_MS,
  SWEEP_BATCH_LIMIT,
  sweepAbandonedUploadsContract,
  sweepAbandonedUploadsInputSchema,
  sweepAbandonedUploadsOutputSchema,
} from "./sweep-abandoned-uploads.contract.js";

describe("files.sweepAbandonedUploads contract", () => {
  it("is a global system write, internal, audited, and idempotent", () => {
    expect(sweepAbandonedUploadsContract.name).toBe(
      "files.sweepAbandonedUploads",
    );
    expect(sweepAbandonedUploadsContract.principal).toBe("system");
    expect(sweepAbandonedUploadsContract.systemScope).toBe("global");
    expect(sweepAbandonedUploadsContract.transport).toBe("internal");
    expect(sweepAbandonedUploadsContract.risk).toBe("write");
    expect(sweepAbandonedUploadsContract.permissions).toEqual([]);
    expect(sweepAbandonedUploadsContract.aiExposure).toBe("internal");
    expect(sweepAbandonedUploadsContract.audit).toBe(true);
    expect(sweepAbandonedUploadsContract.idempotent).toBe(true);
    expect(sweepAbandonedUploadsContract.emits).toEqual([]);
    expect(sweepAbandonedUploadsContract.timeout).toBe(30_000);
    expect(ABANDONED_PENDING_TTL_MS).toBe(60 * 60 * 1000);
    expect(SWEEP_BATCH_LIMIT).toBe(20);
    expect(sweepAbandonedUploadsContract.description).toContain(
      "pending catalog or signing",
    );
    expect(sweepAbandonedUploadsContract.description).toContain(
      "document objects are never deleted",
    );
    expect(sweepAbandonedUploadsContract.description).toContain(
      "unsigned ZIP is never treated as durable",
    );
  });

  it("accepts an optional batch limit and never returns a URL, object key, or file id", () => {
    expect(
      Object.keys(sweepAbandonedUploadsInputSchema.shape).toSorted(),
    ).toEqual(["limit"]);
    expect(
      Object.keys(sweepAbandonedUploadsOutputSchema.shape).toSorted(),
    ).toEqual(["abandonedPendingDeleted", "leftoverStagingDeleted"]);
    expect(sweepAbandonedUploadsInputSchema.parse({})).toEqual({});
    expect(sweepAbandonedUploadsInputSchema.parse({ limit: 1 })).toEqual({
      limit: 1,
    });
  });
});
