import { describe, expect, it } from "vitest";

import {
  getProductOrderFactsContract,
  PRODUCT_ORDER_FACTS_MAX_ITEMS,
} from "./get-product-order-facts.contract.js";

describe("catalog.getProductOrderFacts contract", () => {
  it("is a staff internal read with products:view", () => {
    expect(getProductOrderFactsContract.name).toBe(
      "catalog.getProductOrderFacts",
    );
    expect(getProductOrderFactsContract.principal).toBe("staff");
    expect(getProductOrderFactsContract.transport).toBe("internal");
    expect(getProductOrderFactsContract.risk).toBe("read");
    expect(getProductOrderFactsContract.permissions).toEqual(["products:view"]);
    expect(getProductOrderFactsContract.aiExposure).toBe("internal");
    expect(getProductOrderFactsContract.audit).toBe(false);
    expect(getProductOrderFactsContract.emits).toEqual([]);
    expect(PRODUCT_ORDER_FACTS_MAX_ITEMS).toBe(200);
  });
});
