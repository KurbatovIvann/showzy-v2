import { describe, expect, it } from "vitest";

import {
  PRICING_RESOLVER_VERSION,
  RESOLVE_PRODUCT_PRICES_MAX_ITEMS,
  resolveProductPricesContract,
} from "./resolve-product-prices.contract.js";

describe("pricing.resolveProductPrices contract", () => {
  it("is a staff client read with pricing:view, AI-exposed", () => {
    expect(resolveProductPricesContract.name).toBe(
      "pricing.resolveProductPrices",
    );
    expect(resolveProductPricesContract.principal).toBe("staff");
    expect(resolveProductPricesContract.transport).toBe("internal");
    expect(resolveProductPricesContract.risk).toBe("read");
    expect(resolveProductPricesContract.permissions).toEqual(["pricing:view"]);
    expect(resolveProductPricesContract.aiExposure).toBe("internal");
    expect(resolveProductPricesContract.audit).toBe(false);
    expect(resolveProductPricesContract.emits).toEqual([]);
    expect(resolveProductPricesContract.timeout).toBe(5_000);
    expect(RESOLVE_PRODUCT_PRICES_MAX_ITEMS).toBe(200);
    expect(PRICING_RESOLVER_VERSION).toBe(1);
  });
});
