import { describe, expect, it } from "vitest";

import {
  markFailedContract,
  markFailedInputSchema,
  markFailedOutputSchema,
} from "./mark-failed.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docGeneration.markFailed contract", () => {
  it("is a tenant system internal write, audited, idempotent, and not AI-exposed", () => {
    expect(markFailedContract.name).toBe("docGeneration.markFailed");
    expect(markFailedContract.principal).toBe("system");
    expect(markFailedContract.systemScope).toBe("tenant");
    expect(markFailedContract.transport).toBe("internal");
    expect(markFailedContract.risk).toBe("write");
    expect(markFailedContract.permissions).toEqual([]);
    expect(markFailedContract.aiExposure).toBe("internal");
    expect(markFailedContract.audit).toBe(true);
    expect(markFailedContract.idempotent).toBe(true);
    expect(markFailedContract.emits).toEqual([]);
    expect(markFailedContract.atomicCalls).toEqual([]);
    expect(markFailedContract.atomicCallers).toEqual([]);
    expect(markFailedContract.timeout).toBe(5_000);
    expect(Object.keys(markFailedOutputSchema.shape).toSorted()).toEqual([
      "documentId",
      "fileId",
      "status",
    ]);
    expect(
      markFailedOutputSchema.shape.status.safeParse("pending").success,
    ).toBe(false);
    expect(markFailedOutputSchema.shape.status.safeParse("ready").success).toBe(
      true,
    );
    expect(
      markFailedOutputSchema.shape.status.safeParse("failed").success,
    ).toBe(true);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(markFailedInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(markFailedInputSchema.safeParse({}).success).toBe(false);
    expect(
      markFailedInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      markFailedInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
