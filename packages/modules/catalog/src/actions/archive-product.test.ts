import { describe, expect, it } from "vitest";

import { archiveProductContract } from "./archive-product.contract.js";

describe("catalog.archiveProduct contract", () => {
  it("is a staff client write with products:edit, idempotent audit, and no events", () => {
    expect(archiveProductContract.name).toBe("catalog.archiveProduct");
    expect(archiveProductContract.principal).toBe("staff");
    expect(archiveProductContract.transport).toBe("client");
    expect(archiveProductContract.risk).toBe("write");
    expect(archiveProductContract.permissions).toEqual(["products:edit"]);
    expect(archiveProductContract.aiExposure).toBe("exposed");
    expect(archiveProductContract.audit).toBe(true);
    expect(archiveProductContract.idempotent).toBe(true);
    expect(archiveProductContract.requiresConfirmation).toBe(false);
    expect(archiveProductContract.emits).toEqual([]);
    expect(archiveProductContract.atomicCalls).toEqual([]);
    expect(archiveProductContract.timeout).toBe(5_000);
    expect(archiveProductContract.description).toContain(
      "variants are not archived",
    );
  });
});
