import { implementAction } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { and, eq, inArray } from "drizzle-orm";

import { getProductOrderFactsContract } from "./get-product-order-facts.contract.js";

function uniqueProductIds(items: readonly { productId: string }[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productId)) {
      continue;
    }
    seen.add(item.productId);
    ids.push(item.productId);
  }
  return ids;
}

function compareVariantId(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export const getProductOrderFacts = implementAction(
  getProductOrderFactsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "catalog.getProductOrderFacts expects staff",
        );
      }

      const productIds = uniqueProductIds(input.items);
      const productRows = await ctx.db
        .select({
          id: products.id,
          name: products.name,
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
          name: productVariants.name,
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
            name: row.name,
            variants: variants.map((variant) => ({
              variantId: variant.id,
              name: variant.name,
            })),
          };
        }),
      };
    },
  },
);
