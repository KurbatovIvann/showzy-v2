import { describe, expect, it } from "vitest";

import {
  getProductPricingFactsContract,
  PRODUCT_PRICING_FACTS_MAX_ITEMS,
} from "./get-product-pricing-facts.contract.js";

describe("catalog.getProductPricingFacts contract", () => {
  it("is a staff internal read with products:view", () => {
    expect(getProductPricingFactsContract.name).toBe(
      "catalog.getProductPricingFacts",
    );
    expect(getProductPricingFactsContract.principal).toBe("staff");
    expect(getProductPricingFactsContract.transport).toBe("internal");
    expect(getProductPricingFactsContract.risk).toBe("read");
    expect(getProductPricingFactsContract.permissions).toEqual([
      "products:view",
    ]);
    expect(getProductPricingFactsContract.aiExposure).toBe("internal");
    expect(getProductPricingFactsContract.audit).toBe(false);
    expect(getProductPricingFactsContract.emits).toEqual([]);
    expect(PRODUCT_PRICING_FACTS_MAX_ITEMS).toBe(200);
  });
});
