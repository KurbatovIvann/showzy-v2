import { describe, expect, it } from "vitest";

import { archiveVariantContract } from "./archive-variant.contract.js";

describe("catalog.archiveVariant contract", () => {
  it("is a staff client write with products:edit, idempotent audit, and no events", () => {
    expect(archiveVariantContract.name).toBe("catalog.archiveVariant");
    expect(archiveVariantContract.principal).toBe("staff");
    expect(archiveVariantContract.transport).toBe("client");
    expect(archiveVariantContract.risk).toBe("write");
    expect(archiveVariantContract.permissions).toEqual(["products:edit"]);
    expect(archiveVariantContract.aiExposure).toBe("exposed");
    expect(archiveVariantContract.audit).toBe(true);
    expect(archiveVariantContract.idempotent).toBe(true);
    expect(archiveVariantContract.requiresConfirmation).toBe(false);
    expect(archiveVariantContract.emits).toEqual([]);
    expect(archiveVariantContract.atomicCalls).toEqual([]);
    expect(archiveVariantContract.timeout).toBe(5_000);
    expect(archiveVariantContract.description).toContain(
      "parent product status is not changed",
    );
  });
});
