import { describe, expect, it } from "vitest";

import {
  getSupplierSignedFlagsContract,
  getSupplierSignedFlagsInputSchema,
  SUPPLIER_SIGNED_FLAGS_MAX_IDS,
} from "./get-supplier-signed-flags.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docSigning.getSupplierSignedFlags contract", () => {
  it("is a staff internal read with documents:view and no audit", () => {
    expect(getSupplierSignedFlagsContract.name).toBe(
      "docSigning.getSupplierSignedFlags",
    );
    expect(getSupplierSignedFlagsContract.principal).toBe("staff");
    expect(getSupplierSignedFlagsContract.transport).toBe("internal");
    expect(getSupplierSignedFlagsContract.risk).toBe("read");
    expect(getSupplierSignedFlagsContract.permissions).toEqual([
      "documents:view",
    ]);
    expect(getSupplierSignedFlagsContract.aiExposure).toBe("internal");
    expect(getSupplierSignedFlagsContract.audit).toBe(false);
    expect(getSupplierSignedFlagsContract.timeout).toBe(5_000);
  });

  it("accepts an empty page and rejects companyId or more than 50 ids", () => {
    expect(
      getSupplierSignedFlagsInputSchema.parse({ documentIds: [] }),
    ).toEqual({ documentIds: [] });
    expect(
      getSupplierSignedFlagsInputSchema.parse({ documentIds: [validId] }),
    ).toEqual({ documentIds: [validId] });
    expect(
      getSupplierSignedFlagsInputSchema.safeParse({
        documentIds: [validId],
        companyId: validId,
      }).success,
    ).toBe(false);
    const oversized = Array.from(
      { length: SUPPLIER_SIGNED_FLAGS_MAX_IDS + 1 },
      () => validId,
    );
    expect(
      getSupplierSignedFlagsInputSchema.safeParse({ documentIds: oversized })
        .success,
    ).toBe(false);
  });
});
