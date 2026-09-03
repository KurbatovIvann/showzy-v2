import { describe, expect, it } from "vitest";

import {
  resolveLayoutContract,
  resolveLayoutInputSchema,
  resolveLayoutOutputSchema,
} from "./resolve-layout.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docGeneration.resolveLayout contract", () => {
  it("is a staff internal read with documents:view and no audit", () => {
    expect(resolveLayoutContract.name).toBe("docGeneration.resolveLayout");
    expect(resolveLayoutContract.principal).toBe("staff");
    expect(resolveLayoutContract.transport).toBe("internal");
    expect(resolveLayoutContract.risk).toBe("read");
    expect(resolveLayoutContract.permissions).toEqual(["documents:view"]);
    expect(resolveLayoutContract.aiExposure).toBe("internal");
    expect(resolveLayoutContract.audit).toBe(false);
    expect(resolveLayoutContract.idempotent).toBe(false);
    expect(resolveLayoutContract.emits).toEqual([]);
    expect(resolveLayoutContract.atomicCalls).toEqual([]);
    expect(resolveLayoutContract.atomicCallers).toEqual([]);
    expect(resolveLayoutContract.timeout).toBe(2_000);
    expect(Object.keys(resolveLayoutOutputSchema.shape).toSorted()).toEqual([
      "key",
      "type",
    ]);
  });

  it("requires layoutKey and type and rejects companyId", () => {
    expect(
      resolveLayoutInputSchema.parse({
        layoutKey: "payment_invoice.branded",
        type: "payment_invoice",
      }),
    ).toEqual({
      layoutKey: "payment_invoice.branded",
      type: "payment_invoice",
    });
    expect(resolveLayoutInputSchema.safeParse({}).success).toBe(false);
    expect(
      resolveLayoutInputSchema.safeParse({
        layoutKey: "payment_invoice.branded",
      }).success,
    ).toBe(false);
    expect(
      resolveLayoutInputSchema.safeParse({
        type: "payment_invoice",
      }).success,
    ).toBe(false);
    expect(
      resolveLayoutInputSchema.safeParse({
        layoutKey: "payment_invoice.branded",
        type: "payment_invoice",
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
