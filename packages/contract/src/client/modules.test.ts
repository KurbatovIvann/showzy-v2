import { describe, expect, it } from "vitest";

import { resolveProductPricesContract } from "@showzy/pricing/contract";

import { contractModules, contractRouter } from "./modules.js";

describe("client composition", () => {
  it("exposes pricing.resolveProductPrices and no internal facts actions", () => {
    expect(contractModules).toEqual({
      pricing: {
        resolveProductPrices: resolveProductPricesContract,
      },
    });
    expect(contractRouter.pricing.resolveProductPrices).toBeDefined();
  });
});
