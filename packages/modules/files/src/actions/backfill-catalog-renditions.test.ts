import { describe, expect, it } from "vitest";

import {
  BACKFILL_BATCH_LIMIT,
  backfillCatalogRenditionsContract,
  backfillCatalogRenditionsInputSchema,
  backfillCatalogRenditionsOutputSchema,
} from "./backfill-catalog-renditions.contract.js";

describe("files.backfillCatalogRenditions contract", () => {
  it("is a global system write, internal, audited, and idempotent", () => {
    expect(backfillCatalogRenditionsContract.name).toBe(
      "files.backfillCatalogRenditions",
    );
    expect(backfillCatalogRenditionsContract.principal).toBe("system");
    expect(backfillCatalogRenditionsContract.systemScope).toBe("global");
    expect(backfillCatalogRenditionsContract.transport).toBe("internal");
    expect(backfillCatalogRenditionsContract.risk).toBe("write");
    expect(backfillCatalogRenditionsContract.permissions).toEqual([]);
    expect(backfillCatalogRenditionsContract.aiExposure).toBe("internal");
    expect(backfillCatalogRenditionsContract.audit).toBe(true);
    expect(backfillCatalogRenditionsContract.idempotent).toBe(true);
    expect(backfillCatalogRenditionsContract.emits).toEqual([]);
    expect(backfillCatalogRenditionsContract.timeout).toBe(30_000);
    expect(BACKFILL_BATCH_LIMIT).toBe(20);
    expect(backfillCatalogRenditionsContract.description).toContain(
      "ready purpose=catalog",
    );
    expect(backfillCatalogRenditionsContract.description).toContain(
      "Skips purpose=document",
    );
    expect(backfillCatalogRenditionsContract.description).toContain(
      "Does not rewrite originals",
    );
    expect(backfillCatalogRenditionsContract.description).toContain(
      "one bounded page",
    );
  });

  it("accepts an optional batch limit and never returns a URL, object key, or file id", () => {
    expect(
      Object.keys(backfillCatalogRenditionsInputSchema.shape).toSorted(),
    ).toEqual(["limit"]);
    expect(
      Object.keys(backfillCatalogRenditionsOutputSchema.shape).toSorted(),
    ).toEqual([
      "alreadyComplete",
      "filled",
      "skippedMissingOriginal",
      "skippedUndecodable",
    ]);
    expect(backfillCatalogRenditionsInputSchema.parse({})).toEqual({});
    expect(backfillCatalogRenditionsInputSchema.parse({ limit: 1 })).toEqual({
      limit: 1,
    });
  });
});
