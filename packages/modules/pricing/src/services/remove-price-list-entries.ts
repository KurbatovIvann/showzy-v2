import type { ActionCtx } from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import { priceListEntries, priceLists } from "@showzy/db/schema/pricing";
import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";

import type { removePriceListEntriesInputSchema } from "../actions/remove-price-list-entries.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type RemoveInput = z.output<typeof removePriceListEntriesInputSchema>;
type RemoveEntry = RemoveInput["entries"][number];

function entryKey(productId: string, variantId: string | undefined): string {
  return variantId === undefined
    ? `${productId}|`
    : `${productId}|${variantId}`;
}

function compareRemoveKeys(left: RemoveEntry, right: RemoveEntry): number {
  if (left.productId !== right.productId) {
    return left.productId < right.productId ? -1 : 1;
  }
  const leftVariant = left.variantId ?? "";
  const rightVariant = right.variantId ?? "";
  if (leftVariant === rightVariant) {
    return 0;
  }
  return leftVariant < rightVariant ? -1 : 1;
}

function uniqueSorted(entries: readonly RemoveEntry[]): RemoveEntry[] {
  const byKey = new Map<string, RemoveEntry>();
  for (const entry of entries) {
    byKey.set(entryKey(entry.productId, entry.variantId), entry);
  }
  return [...byKey.values()].toSorted(compareRemoveKeys);
}

export async function removeStaffPriceListEntries(env: {
  readonly ctx: StaffCtx;
  readonly input: RemoveInput;
}): Promise<{ priceListId: string }> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const list = (
    await db
      .select({ id: priceLists.id })
      .from(priceLists)
      .where(
        and(
          eq(priceLists.companyId, ctx.companyId),
          eq(priceLists.id, input.priceListId),
        ),
      )
      .limit(1)
      .for("update")
  )[0];
  if (list === undefined) {
    throw new NotFoundError();
  }

  for (const entry of uniqueSorted(input.entries)) {
    await db
      .delete(priceListEntries)
      .where(
        and(
          eq(priceListEntries.companyId, ctx.companyId),
          eq(priceListEntries.priceListId, input.priceListId),
          eq(priceListEntries.productId, entry.productId),
          entry.variantId === undefined
            ? isNull(priceListEntries.variantId)
            : eq(priceListEntries.variantId, entry.variantId),
        ),
      );
  }

  ctx.log.info(
    {
      price_list_id: input.priceListId,
      entry_count: input.entries.length,
    },
    "pricing.removePriceListEntries removed price-list entries",
  );

  return { priceListId: input.priceListId };
}
