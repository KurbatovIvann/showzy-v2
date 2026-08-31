import { moneyToCanonical, requireUah } from "@showzy/module-kit/canonical";
import type { z } from "zod";

import type { priceListEntryRowSchema } from "../actions/list-price-list-entries.contract.js";

export type PriceListEntryView = z.output<typeof priceListEntryRowSchema>;

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
