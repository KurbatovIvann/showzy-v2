import type { ActionCtx } from "@showzy/core";
import { priceListEntries } from "@showzy/db/schema/pricing";
import { and, count, eq, inArray } from "drizzle-orm";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];

export async function countEntriesByPriceListIds(
  db: StaffDb,
  companyId: string,
  priceListIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (priceListIds.length === 0) {
    return result;
  }
  const rows = await db
    .select({
      priceListId: priceListEntries.priceListId,
      value: count(),
    })
    .from(priceListEntries)
    .where(
      and(
        eq(priceListEntries.companyId, companyId),
        inArray(priceListEntries.priceListId, [...priceListIds]),
      ),
    )
    .groupBy(priceListEntries.priceListId);
  for (const row of rows) {
    result.set(row.priceListId, row.value);
  }
  return result;
}

export async function countPriceListEntries(
  db: StaffDb,
  companyId: string,
  priceListId: string,
): Promise<number> {
  const counts = await countEntriesByPriceListIds(db, companyId, [priceListId]);
  return counts.get(priceListId) ?? 0;
}
