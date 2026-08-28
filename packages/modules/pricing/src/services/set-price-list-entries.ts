import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { priceListEntries, priceLists } from "@showzy/db/schema/pricing";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { setPriceListEntriesInputSchema } from "../actions/set-price-list-entries.contract.js";
import { moneyFromCanonical } from "./canonical.js";
import {
  toPriceListEntryView,
  type PriceListEntryView,
} from "./price-list-entry-view.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type SetInput = z.output<typeof setPriceListEntriesInputSchema>;
type SetEntry = SetInput["entries"][number];

const entryReturning = {
  id: priceListEntries.id,
  priceListId: priceListEntries.priceListId,
  productId: priceListEntries.productId,
  variantId: priceListEntries.variantId,
  priceMinor: priceListEntries.priceMinor,
  currency: priceListEntries.currency,
} as const;

function entryKey(productId: string, variantId: string | null): string {
  return variantId === null ? `${productId}|` : `${productId}|${variantId}`;
}

function compareEntryKeys(
  left: { readonly productId: string; readonly variantId: string | null },
  right: { readonly productId: string; readonly variantId: string | null },
): number {
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

function lastWriteWins(entries: readonly SetEntry[]): SetEntry[] {
  const byKey = new Map<string, SetEntry>();
  for (const entry of entries) {
    byKey.set(entryKey(entry.productId, entry.variantId ?? null), entry);
  }
  return [...byKey.values()].toSorted((left, right) =>
    compareEntryKeys(
      { productId: left.productId, variantId: left.variantId ?? null },
      { productId: right.productId, variantId: right.variantId ?? null },
    ),
  );
}

export async function setStaffPriceListEntries(env: {
  readonly ctx: StaffCtx;
  readonly input: SetInput;
}): Promise<{ items: PriceListEntryView[] }> {
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

  const entries = lastWriteWins(input.entries);
  const productIds = [...new Set(entries.map((entry) => entry.productId))];
  const existingRows = await db
    .select({
      id: priceListEntries.id,
      productId: priceListEntries.productId,
      variantId: priceListEntries.variantId,
    })
    .from(priceListEntries)
    .where(
      and(
        eq(priceListEntries.companyId, ctx.companyId),
        eq(priceListEntries.priceListId, input.priceListId),
        inArray(priceListEntries.productId, productIds),
      ),
    )
    .orderBy(asc(priceListEntries.productId), asc(priceListEntries.variantId))
    .for("update");

  const existingByKey = new Map(
    existingRows.map((row) => [entryKey(row.productId, row.variantId), row.id]),
  );

  const items: PriceListEntryView[] = [];
  for (const entry of entries) {
    const variantId = entry.variantId ?? null;
    const existingId = existingByKey.get(entryKey(entry.productId, variantId));
    const priceMinor = moneyFromCanonical(entry.priceMinor);
    if (existingId === undefined) {
      const inserted = (
        await db
          .insert(priceListEntries)
          .values({
            id: randomUUID(),
            companyId: ctx.companyId,
            priceListId: input.priceListId,
            productId: entry.productId,
            variantId,
            priceMinor,
            currency: entry.currency,
          })
          .returning(entryReturning)
      )[0];
      if (inserted === undefined) {
        throw new CoreInvariantError(
          "pricing.setPriceListEntries insert returned no row",
        );
      }
      items.push(toPriceListEntryView(inserted));
      continue;
    }

    const updated = (
      await db
        .update(priceListEntries)
        .set({
          priceMinor,
          currency: entry.currency,
        })
        .where(
          and(
            eq(priceListEntries.companyId, ctx.companyId),
            eq(priceListEntries.id, existingId),
          ),
        )
        .returning(entryReturning)
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "pricing.setPriceListEntries update returned no row",
      );
    }
    items.push(toPriceListEntryView(updated));
  }

  ctx.log.info(
    {
      price_list_id: input.priceListId,
      entry_count: items.length,
    },
    "pricing.setPriceListEntries upserted price-list entries",
  );

  return { items };
}
