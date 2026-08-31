import { implementAction } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import { and, eq, inArray } from "drizzle-orm";

import { getProductPricingFactsContract } from "./get-product-pricing-facts.contract.js";

function compareVariantId(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export const getProductPricingFacts = implementAction(
  getProductPricingFactsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "catalog.getProductPricingFacts expects staff",
        );
      }

      const productIds = uniqueIds(input.items.map((item) => item.productId));
      const productRows = await ctx.db
        .select({
          id: products.id,
          basePriceMinor: products.basePriceMinor,
          currency: products.currency,
        })
        .from(products)
        .where(
          and(
            eq(products.companyId, ctx.companyId),
            inArray(products.id, productIds),
          ),
        );

      if (productRows.length !== productIds.length) {
        throw new NotFoundError();
      }

      const variantRows = await ctx.db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          basePriceMinor: productVariants.basePriceMinor,
          currency: productVariants.currency,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.companyId, ctx.companyId),
            inArray(productVariants.productId, productIds),
          ),
        );

      const variantsByProduct = new Map<string, typeof variantRows>();
      for (const row of variantRows) {
        const existing = variantsByProduct.get(row.productId);
        if (existing === undefined) {
          variantsByProduct.set(row.productId, [row]);
        } else {
          existing.push(row);
        }
      }

      for (const item of input.items) {
        if (item.variantId === undefined) {
          continue;
        }
        const owned = variantsByProduct.get(item.productId) ?? [];
        if (!owned.some((variant) => variant.id === item.variantId)) {
          throw new NotFoundError();
        }
      }

      const productById = new Map(productRows.map((row) => [row.id, row]));
      return {
        products: productIds.map((productId) => {
          const row = productById.get(productId);
          if (row === undefined) {
            throw new CoreInvariantError(
              "product row missing after the existence check",
            );
          }
          const variants = [...(variantsByProduct.get(productId) ?? [])].sort(
            (left, right) => compareVariantId(left.id, right.id),
          );
          return {
            productId: row.id,
            basePriceMinor: moneyToCanonical(row.basePriceMinor),
            currency: row.currency,
            variants: variants.map((variant) => ({
              variantId: variant.id,
              basePriceMinor:
                variant.basePriceMinor === null
                  ? null
                  : moneyToCanonical(variant.basePriceMinor),
              currency: variant.currency,
            })),
          };
        }),
      };
    },
  },
);
