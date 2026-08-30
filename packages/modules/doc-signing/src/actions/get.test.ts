import { describe, expect, it } from "vitest";

import {
  getSigningContract,
  getSigningInputSchema,
  getSigningOutputSchema,
} from "./get.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docSigning.get contract", () => {
  it("is a staff client read with documents:view and no audit", () => {
    expect(getSigningContract.name).toBe("docSigning.get");
    expect(getSigningContract.principal).toBe("staff");
    expect(getSigningContract.transport).toBe("client");
    expect(getSigningContract.risk).toBe("read");
    expect(getSigningContract.permissions).toEqual(["documents:view"]);
    expect(getSigningContract.aiExposure).toBe("internal");
    expect(getSigningContract.audit).toBe(false);
    expect(getSigningContract.idempotent).toBe(false);
    expect(getSigningContract.emits).toEqual([]);
    expect(getSigningContract.atomicCalls).toEqual([]);
    expect(getSigningContract.atomicCallers).toEqual([]);
    expect(getSigningContract.timeout).toBe(5_000);
    expect(Object.keys(getSigningOutputSchema.shape).toSorted()).toEqual([
      "requestId",
      "signedFileId",
      "status",
    ]);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(getSigningInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(getSigningInputSchema.safeParse({}).success).toBe(false);
    expect(
      getSigningInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      getSigningInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
