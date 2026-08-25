import { describe, expect, it } from "vitest";

import { restoreVariantContract } from "./restore-variant.contract.js";

describe("catalog.restoreVariant contract", () => {
  it("is a staff client write with products:edit, idempotent audit, and no events", () => {
    expect(restoreVariantContract.name).toBe("catalog.restoreVariant");
    expect(restoreVariantContract.principal).toBe("staff");
    expect(restoreVariantContract.transport).toBe("client");
    expect(restoreVariantContract.risk).toBe("write");
    expect(restoreVariantContract.permissions).toEqual(["products:edit"]);
    expect(restoreVariantContract.aiExposure).toBe("exposed");
    expect(restoreVariantContract.audit).toBe(true);
    expect(restoreVariantContract.idempotent).toBe(true);
    expect(restoreVariantContract.requiresConfirmation).toBe(false);
    expect(restoreVariantContract.emits).toEqual([]);
    expect(restoreVariantContract.atomicCalls).toEqual([]);
    expect(restoreVariantContract.timeout).toBe(5_000);
    expect(restoreVariantContract.description).toContain(
      "parent product status is not changed",
    );
  });
});
