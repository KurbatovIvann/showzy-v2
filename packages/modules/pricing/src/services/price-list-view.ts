import type { z } from "zod";

import type { getPriceListOutputSchema } from "../actions/get-price-list.contract.js";

export type PriceListView = z.output<typeof getPriceListOutputSchema>;

export function toPriceListView(
  row: {
    readonly id: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  },
  entryCount: number,
): PriceListView {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    isActive: row.isActive,
    entryCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
