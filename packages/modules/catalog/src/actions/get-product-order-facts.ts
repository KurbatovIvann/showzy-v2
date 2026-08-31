import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { loadProductFacts } from "../services/load-product-facts.js";
import { getProductOrderFactsContract } from "./get-product-order-facts.contract.js";

export const getProductOrderFacts = implementAction(
  getProductOrderFactsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "catalog.getProductOrderFacts expects staff",
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
          name: product.name,
          variants: product.variants.map((variant) => ({
            variantId: variant.variantId,
            name: variant.name,
          })),
        })),
      };
    },
  },
);
