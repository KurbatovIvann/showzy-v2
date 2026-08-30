import { describe, expect, it } from "vitest";

import {
  getArtifactContract,
  getArtifactInputSchema,
  getArtifactOutputSchema,
} from "./get-artifact.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docGeneration.getArtifact contract", () => {
  it("is a staff internal read with documents:view and no audit", () => {
    expect(getArtifactContract.name).toBe("docGeneration.getArtifact");
    expect(getArtifactContract.principal).toBe("staff");
    expect(getArtifactContract.transport).toBe("internal");
    expect(getArtifactContract.risk).toBe("read");
    expect(getArtifactContract.permissions).toEqual(["documents:view"]);
    expect(getArtifactContract.aiExposure).toBe("internal");
    expect(getArtifactContract.audit).toBe(false);
    expect(getArtifactContract.idempotent).toBe(false);
    expect(getArtifactContract.emits).toEqual([]);
    expect(getArtifactContract.atomicCalls).toEqual([]);
    expect(getArtifactContract.atomicCallers).toEqual([]);
    expect(getArtifactContract.timeout).toBe(2_000);
    expect(Object.keys(getArtifactOutputSchema.shape).toSorted()).toEqual([
      "fileId",
      "status",
    ]);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(getArtifactInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(getArtifactInputSchema.safeParse({}).success).toBe(false);
    expect(
      getArtifactInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      getArtifactInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
