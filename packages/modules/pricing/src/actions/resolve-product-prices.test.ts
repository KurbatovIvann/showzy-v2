import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PRICING_RESOLVER_VERSION,
  RESOLVE_PRODUCT_PRICES_MAX_ITEMS,
  resolveProductPricesContract,
} from "./resolve-product-prices.contract.js";

const root = dirname(fileURLToPath(import.meta.url));

function executableSource(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

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

describe("pricing → customers source guard (SHO-88)", () => {
  it("nests the pricing facts through the leaf entry, not the customers barrel", () => {
    const source = executableSource("resolve-product-prices.ts");
    expect(source).toContain("@showzy/customers/get-customer-pricing-facts");
    expect(source).not.toContain('from "@showzy/customers"');
    expect(source).toContain("ctx.call(getCustomerPricingFacts");
  });
});
