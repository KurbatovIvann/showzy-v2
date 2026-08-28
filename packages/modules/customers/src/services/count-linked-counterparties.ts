import { counterparties } from "@showzy/db/schema/customers";
import { and, count, eq, inArray } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

type CounterpartyCountDb = Pick<WritableStaffDb, "select">;

export async function countLinkedCounterparties(
  db: CounterpartyCountDb,
  companyId: string,
  customerId: string,
): Promise<number> {
  const counts = await countLinkedCounterpartiesByCustomerIds(db, companyId, [
    customerId,
  ]);
  return counts.get(customerId) ?? 0;
}

export async function countLinkedCounterpartiesByCustomerIds(
  db: CounterpartyCountDb,
  companyId: string,
  customerIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (customerIds.length === 0) {
    return result;
  }
  const rows = await db
    .select({
      customerId: counterparties.customerId,
      value: count(),
    })
    .from(counterparties)
    .where(
      and(
        eq(counterparties.companyId, companyId),
        inArray(counterparties.customerId, [...customerIds]),
      ),
    )
    .groupBy(counterparties.customerId);
  for (const row of rows) {
    if (row.customerId !== null) {
      result.set(row.customerId, row.value);
    }
  }
  return result;
}
