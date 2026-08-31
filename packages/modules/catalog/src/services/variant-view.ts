import { CoreInvariantError } from "@showzy/core/errors";
import {
  moneyFromCanonical,
  moneyToCanonical,
  requireUahOrNull,
} from "@showzy/module-kit/canonical";
import type { z } from "zod";

import type { variantViewSchema } from "../actions/variant-view.contract.js";

type VariantView = z.output<typeof variantViewSchema>;

export function variantPriceFields(fields: {
  readonly basePriceMinor?: string | undefined;
  readonly currency?: "UAH" | undefined;
}): {
  readonly basePriceMinor: bigint | null;
  readonly currency: string | null;
} {
  if (fields.basePriceMinor !== undefined && fields.currency !== undefined) {
    return {
      basePriceMinor: moneyFromCanonical(fields.basePriceMinor),
      currency: fields.currency,
    };
  }
  if (fields.basePriceMinor === undefined && fields.currency === undefined) {
    return { basePriceMinor: null, currency: null };
  }
  throw new CoreInvariantError(
    "variant price and currency pairing survived input validation unpaired",
  );
}

export function toVariantView(variant: {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly basePriceMinor: bigint | null;
  readonly currency: string | null;
}): VariantView {
  return {
    variantId: variant.id,
    productId: variant.productId,
    name: variant.name,
    basePriceMinor:
      variant.basePriceMinor === null
        ? null
        : moneyToCanonical(variant.basePriceMinor),
    currency: requireUahOrNull(variant.currency),
  };
}
