import type { z } from "zod";

import type { productViewSchema } from "../actions/product-view.contract.js";
import { moneyToCanonical } from "./canonical.js";

type ProductView = z.output<typeof productViewSchema>;

export function compareVariantId(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function toProductView(
  product: {
    readonly id: string;
    readonly name: string;
    readonly basePriceMinor: bigint;
    readonly currency: string;
  },
  variants: readonly {
    readonly id: string;
    readonly name: string;
    readonly basePriceMinor: bigint | null;
    readonly currency: string | null;
  }[],
): ProductView {
  return {
    productId: product.id,
    name: product.name,
    basePriceMinor: moneyToCanonical(product.basePriceMinor),
    currency: product.currency,
    variants: [...variants]
      .sort((left, right) => compareVariantId(left.id, right.id))
      .map((variant) => ({
        variantId: variant.id,
        name: variant.name,
        basePriceMinor:
          variant.basePriceMinor === null
            ? null
            : moneyToCanonical(variant.basePriceMinor),
        currency: variant.currency,
      })),
  };
}
