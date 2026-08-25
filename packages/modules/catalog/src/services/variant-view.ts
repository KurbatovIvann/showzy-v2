import { CoreInvariantError } from "@showzy/core/errors";
import type { z } from "zod";

import type { variantViewSchema } from "../actions/variant-view.contract.js";
import { moneyFromCanonical, moneyToCanonical } from "./canonical.js";

type VariantView = z.output<typeof variantViewSchema>;

function requireUah(currency: string): "UAH" {
  if (currency !== "UAH") {
    throw new CoreInvariantError(
      "catalog write view expected UAH (db.md §11 UAH-only MVP)",
    );
  }
  return "UAH";
}

function requireUahOrNull(currency: string | null): "UAH" | null {
  if (currency === null) {
    return null;
  }
  return requireUah(currency);
}

export function variantPriceFields(fields: {
  readonly basePriceMinor?: string;
  readonly currency?: "UAH";
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
