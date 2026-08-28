import { CoreInvariantError } from "@showzy/core/errors";
import type { z } from "zod";

import type { priceListEntryRowSchema } from "../actions/list-price-list-entries.contract.js";
import { moneyToCanonical } from "./canonical.js";

export type PriceListEntryView = z.output<typeof priceListEntryRowSchema>;

function requireUah(currency: string): "UAH" {
  if (currency !== "UAH") {
    throw new CoreInvariantError(
      "pricing entry view expected UAH (db.md §11 UAH-only MVP)",
    );
  }
  return "UAH";
}

export function toPriceListEntryView(row: {
  readonly id: string;
  readonly priceListId: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: bigint;
  readonly currency: string;
}): PriceListEntryView {
  return {
    id: row.id,
    priceListId: row.priceListId,
    productId: row.productId,
    variantId: row.variantId,
    priceMinor: moneyToCanonical(row.priceMinor),
    currency: requireUah(row.currency),
  };
}
