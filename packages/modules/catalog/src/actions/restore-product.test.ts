import { describe, expect, it } from "vitest";

import { restoreProductContract } from "./restore-product.contract.js";

describe("catalog.restoreProduct contract", () => {
  it("is a staff client write with products:edit, idempotent audit, and no events", () => {
    expect(restoreProductContract.name).toBe("catalog.restoreProduct");
    expect(restoreProductContract.principal).toBe("staff");
    expect(restoreProductContract.transport).toBe("client");
    expect(restoreProductContract.risk).toBe("write");
    expect(restoreProductContract.permissions).toEqual(["products:edit"]);
    expect(restoreProductContract.aiExposure).toBe("exposed");
    expect(restoreProductContract.audit).toBe(true);
    expect(restoreProductContract.idempotent).toBe(true);
    expect(restoreProductContract.requiresConfirmation).toBe(false);
    expect(restoreProductContract.emits).toEqual([]);
    expect(restoreProductContract.atomicCalls).toEqual([]);
    expect(restoreProductContract.timeout).toBe(5_000);
    expect(restoreProductContract.description).toContain(
      "variants are not restored",
    );
  });
});
