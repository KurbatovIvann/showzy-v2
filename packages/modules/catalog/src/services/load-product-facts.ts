import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import { and, eq, inArray } from "drizzle-orm";

import { compareVariantId } from "./product-view.js";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];

export interface ProductFactItem {
  readonly productId: string;
  readonly variantId?: string | undefined;
}

export interface LoadedProductFact {
  readonly productId: string;
  readonly name: string;
  readonly basePriceMinor: bigint;
  readonly currency: string;
  readonly variants: readonly {
    readonly variantId: string;
    readonly name: string;
    readonly basePriceMinor: bigint | null;
    readonly currency: string | null;
  }[];
}

/**
 * Shared product+variant load for pricing and order-title facts.
 * Tenant predicate is `companyId` from the verified staff context.
 */
export async function loadProductFacts(args: {
  readonly db: StaffDb;
  readonly companyId: string;
  readonly items: readonly ProductFactItem[];
}): Promise<readonly LoadedProductFact[]> {
  const productIds = uniqueIds(args.items.map((item) => item.productId));
  const productRows = await args.db
    .select({
      id: products.id,
      name: products.name,
      basePriceMinor: products.basePriceMinor,
      currency: products.currency,
    })
    .from(products)
    .where(
      and(
        eq(products.companyId, args.companyId),
        inArray(products.id, productIds),
      ),
    );

  if (productRows.length !== productIds.length) {
    throw new NotFoundError();
  }

  const variantRows = await args.db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      basePriceMinor: productVariants.basePriceMinor,
      currency: productVariants.currency,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, args.companyId),
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

  for (const item of args.items) {
    if (item.variantId === undefined) {
      continue;
    }
    const owned = variantsByProduct.get(item.productId) ?? [];
    if (!owned.some((variant) => variant.id === item.variantId)) {
      throw new NotFoundError();
    }
  }

  const productById = new Map(productRows.map((row) => [row.id, row]));
  return productIds.map((productId) => {
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
      basePriceMinor: row.basePriceMinor,
      currency: row.currency,
      variants: variants.map((variant) => ({
        variantId: variant.id,
        name: variant.name,
        basePriceMinor: variant.basePriceMinor,
        currency: variant.currency,
      })),
    };
  });
}
