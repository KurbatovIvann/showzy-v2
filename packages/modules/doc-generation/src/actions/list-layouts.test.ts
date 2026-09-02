import { describe, expect, it } from "vitest";

import {
  listLayoutsContract,
  listLayoutsInputSchema,
  listLayoutsOutputSchema,
} from "./list-layouts.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("docGeneration.listLayouts contract", () => {
  it("is a staff client read with documents:view, exposed, and no audit", () => {
    expect(listLayoutsContract.name).toBe("docGeneration.listLayouts");
    expect(listLayoutsContract.principal).toBe("staff");
    expect(listLayoutsContract.transport).toBe("client");
    expect(listLayoutsContract.risk).toBe("read");
    expect(listLayoutsContract.permissions).toEqual(["documents:view"]);
    expect(listLayoutsContract.aiExposure).toBe("exposed");
    expect(listLayoutsContract.audit).toBe(false);
    expect(listLayoutsContract.idempotent).toBe(false);
    expect(listLayoutsContract.emits).toEqual([]);
    expect(listLayoutsContract.atomicCalls).toEqual([]);
    expect(listLayoutsContract.atomicCallers).toEqual([]);
    expect(listLayoutsContract.timeout).toBe(2_000);
    expect(Object.keys(listLayoutsOutputSchema.shape).toSorted()).toEqual([
      "layouts",
    ]);
  });

  it("accepts an empty object or a type filter and rejects companyId", () => {
    expect(listLayoutsInputSchema.parse({})).toEqual({});
    expect(listLayoutsInputSchema.parse({ type: "payment_invoice" })).toEqual({
      type: "payment_invoice",
    });
    expect(listLayoutsInputSchema.parse({ type: "delivery_note" })).toEqual({
      type: "delivery_note",
    });
    expect(
      listLayoutsInputSchema.safeParse({ type: "completion_act" }).success,
    ).toBe(false);
    expect(
      listLayoutsInputSchema.safeParse({ companyId: validId }).success,
    ).toBe(false);
    expect(
      listLayoutsInputSchema.safeParse({
        type: "payment_invoice",
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
