import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceListEntries } from "@showzy/db/schema/pricing";
import { and, eq, isNull, or } from "drizzle-orm";
import type { z } from "zod";

import type { removePriceListEntriesInputSchema } from "../actions/remove-price-list-entries.contract.js";
import { comparePriceListEntryKeys, entryKey } from "./entry-keys.js";
import { requireLockedPriceListId } from "./locked-price-list.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type RemoveInput = z.output<typeof removePriceListEntriesInputSchema>;
type RemoveEntry = RemoveInput["entries"][number];

/** One DELETE stays well under Postgres parameter limits at the 200-key cap. */
const REMOVE_ENTRY_DELETE_CHUNK = 200;

function uniqueSorted(entries: readonly RemoveEntry[]): RemoveEntry[] {
  const byKey = new Map<string, RemoveEntry>();
  for (const entry of entries) {
    byKey.set(entryKey(entry.productId, entry.variantId), entry);
  }
  return [...byKey.values()].toSorted(comparePriceListEntryKeys);
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function entryKeyPredicate(entry: RemoveEntry) {
  const predicate = and(
    eq(priceListEntries.productId, entry.productId),
    entry.variantId === undefined
      ? isNull(priceListEntries.variantId)
      : eq(priceListEntries.variantId, entry.variantId),
  );
  if (predicate === undefined) {
    throw new CoreInvariantError(
      "pricing.removePriceListEntries built an empty key predicate",
    );
  }
  return predicate;
}

function matchAnyEntryKey(entries: readonly RemoveEntry[]) {
  const predicates = entries.map(entryKeyPredicate);
  const first = predicates[0];
  if (first === undefined) {
    throw new CoreInvariantError(
      "pricing.removePriceListEntries delete chunk was empty",
    );
  }
  const combined = or(first, ...predicates.slice(1));
  if (combined === undefined) {
    throw new CoreInvariantError(
      "pricing.removePriceListEntries delete predicate was empty",
    );
  }
  return combined;
}

export async function removeStaffPriceListEntries(env: {
  readonly ctx: StaffCtx;
  readonly input: RemoveInput;
}): Promise<{ priceListId: string }> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  await requireLockedPriceListId(db, ctx.companyId, input.priceListId);

  const keys = uniqueSorted(input.entries);
  for (const chunk of chunksOf(keys, REMOVE_ENTRY_DELETE_CHUNK)) {
    await db
      .delete(priceListEntries)
      .where(
        and(
          eq(priceListEntries.companyId, ctx.companyId),
          eq(priceListEntries.priceListId, input.priceListId),
          matchAnyEntryKey(chunk),
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
