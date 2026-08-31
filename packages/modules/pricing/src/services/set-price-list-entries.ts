import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceListEntries } from "@showzy/db/schema/pricing";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

import type { setPriceListEntriesInputSchema } from "../actions/set-price-list-entries.contract.js";
import { moneyFromCanonical } from "./canonical.js";
import { comparePriceListEntryKeys, entryKey } from "./entry-keys.js";
import { requireLockedPriceListId } from "./locked-price-list.js";
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

type EntryReturning = {
  readonly id: string;
  readonly priceListId: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: bigint;
  readonly currency: string;
};

type PreparedEntry = {
  readonly entry: SetEntry;
  readonly variantId: string | null;
  readonly priceMinor: bigint;
  readonly existingId: string | undefined;
};

function lastWriteWins(entries: readonly SetEntry[]): SetEntry[] {
  const byKey = new Map<string, SetEntry>();
  for (const entry of entries) {
    byKey.set(entryKey(entry.productId, entry.variantId ?? null), entry);
  }
  return [...byKey.values()].toSorted(comparePriceListEntryKeys);
}

function caseBigintByEntryId(
  rows: readonly { readonly id: string; readonly value: bigint }[],
) {
  return sql<bigint>`case ${priceListEntries.id} ${sql.join(
    rows.map((row) => sql`when ${row.id} then ${row.value}::bigint`),
    sql` `,
  )} end`;
}

function caseTextByEntryId(
  rows: readonly { readonly id: string; readonly value: string }[],
) {
  return sql<string>`case ${priceListEntries.id} ${sql.join(
    rows.map((row) => sql`when ${row.id} then ${row.value}`),
    sql` `,
  )} end`;
}

export async function setStaffPriceListEntries(env: {
  readonly ctx: StaffCtx;
  readonly input: SetInput;
}): Promise<{ items: PriceListEntryView[] }> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  await requireLockedPriceListId(db, ctx.companyId, input.priceListId);

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

  const prepared: PreparedEntry[] = entries.map((entry) => {
    const variantId = entry.variantId ?? null;
    return {
      entry,
      variantId,
      priceMinor: moneyFromCanonical(entry.priceMinor),
      existingId: existingByKey.get(entryKey(entry.productId, variantId)),
    };
  });

  const toInsert = prepared.filter((row) => row.existingId === undefined);
  const toUpdate = prepared.flatMap((row) => {
    if (row.existingId === undefined) {
      return [];
    }
    return [{ ...row, existingId: row.existingId }];
  });

  const returnedByKey = new Map<string, EntryReturning>();

  if (toInsert.length > 0) {
    const inserted = await db
      .insert(priceListEntries)
      .values(
        toInsert.map((row) => ({
          id: randomUUID(),
          companyId: ctx.companyId,
          priceListId: input.priceListId,
          productId: row.entry.productId,
          variantId: row.variantId,
          priceMinor: row.priceMinor,
          currency: row.entry.currency,
        })),
      )
      .returning(entryReturning);
    if (inserted.length !== toInsert.length) {
      throw new CoreInvariantError(
        "pricing.setPriceListEntries insert returned the wrong number of rows",
      );
    }
    for (const row of inserted) {
      returnedByKey.set(entryKey(row.productId, row.variantId), row);
    }
  }

  // Partial unique indexes cannot be a single ON CONFLICT target (SHO-280).
  if (toUpdate.length > 0) {
    const updated = await db
      .update(priceListEntries)
      .set({
        priceMinor: caseBigintByEntryId(
          toUpdate.map((row) => ({
            id: row.existingId,
            value: row.priceMinor,
          })),
        ),
        currency: caseTextByEntryId(
          toUpdate.map((row) => ({
            id: row.existingId,
            value: row.entry.currency,
          })),
        ),
      })
      .where(
        and(
          eq(priceListEntries.companyId, ctx.companyId),
          inArray(
            priceListEntries.id,
            toUpdate.map((row) => row.existingId),
          ),
        ),
      )
      .returning(entryReturning);
    if (updated.length !== toUpdate.length) {
      throw new CoreInvariantError(
        "pricing.setPriceListEntries update returned the wrong number of rows",
      );
    }
    for (const row of updated) {
      returnedByKey.set(entryKey(row.productId, row.variantId), row);
    }
  }

  const items = prepared.map((row) => {
    const returned = returnedByKey.get(
      entryKey(row.entry.productId, row.variantId),
    );
    if (returned === undefined) {
      throw new CoreInvariantError(
        "pricing.setPriceListEntries missing returned row",
      );
    }
    return toPriceListEntryView(returned);
  });

  ctx.log.info(
    {
      price_list_id: input.priceListId,
      entry_count: items.length,
    },
    "pricing.setPriceListEntries upserted price-list entries",
  );

  return { items };
}
