import { describe, expect, it } from "vitest";

import {
  getForGenerationContract,
  getForGenerationInputSchema,
} from "./get-for-generation.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("documents.getForGeneration contract", () => {
  it("is a tenant system internal read for PDF substitution", () => {
    expect(getForGenerationContract.name).toBe("documents.getForGeneration");
    expect(getForGenerationContract.principal).toBe("system");
    expect(getForGenerationContract.systemScope).toBe("tenant");
    expect(getForGenerationContract.transport).toBe("internal");
    expect(getForGenerationContract.risk).toBe("read");
    expect(getForGenerationContract.permissions).toEqual([]);
    expect(getForGenerationContract.aiExposure).toBe("internal");
    expect(getForGenerationContract.audit).toBe(false);
    expect(getForGenerationContract.timeout).toBe(5_000);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(getForGenerationInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(
      getForGenerationInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
