import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { moneyToCanonical } from "@showzy/module-kit/canonical";

import { loadProductFacts } from "../services/load-product-facts.js";
import { getProductPricingFactsContract } from "./get-product-pricing-facts.contract.js";

export const getProductPricingFacts = implementAction(
  getProductPricingFactsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "catalog.getProductPricingFacts expects staff",
        );
      }

      const facts = await loadProductFacts({
        db: ctx.db,
        companyId: ctx.companyId,
        items: input.items,
      });
      return {
        products: facts.map((product) => ({
          productId: product.productId,
          basePriceMinor: moneyToCanonical(product.basePriceMinor),
          currency: product.currency,
          variants: product.variants.map((variant) => ({
            variantId: variant.variantId,
            basePriceMinor:
              variant.basePriceMinor === null
                ? null
                : moneyToCanonical(variant.basePriceMinor),
            currency: variant.currency,
          })),
        })),
      };
    },
  },
);
