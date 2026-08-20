import { describe, expect, it } from "vitest";

import { getCustomerPricingFactsContract } from "./get-customer-pricing-facts.contract.js";

describe("customers.getCustomerPricingFacts contract", () => {
  it("is a staff internal read with customers:view", () => {
    expect(getCustomerPricingFactsContract.name).toBe(
      "customers.getCustomerPricingFacts",
    );
    expect(getCustomerPricingFactsContract.principal).toBe("staff");
    expect(getCustomerPricingFactsContract.transport).toBe("internal");
    expect(getCustomerPricingFactsContract.risk).toBe("read");
    expect(getCustomerPricingFactsContract.permissions).toEqual([
      "customers:view",
    ]);
    expect(getCustomerPricingFactsContract.aiExposure).toBe("internal");
    expect(getCustomerPricingFactsContract.audit).toBe(false);
    expect(getCustomerPricingFactsContract.emits).toEqual([]);
    expect(getCustomerPricingFactsContract.timeout).toBe(5_000);
  });
});
