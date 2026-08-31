import { NotFoundError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

export const priceListViewColumns = {
  id: priceLists.id,
  name: priceLists.name,
  isDefault: priceLists.isDefault,
  isActive: priceLists.isActive,
  createdAt: priceLists.createdAt,
  updatedAt: priceLists.updatedAt,
} as const;

export async function requireLockedPriceList(
  db: WritableStaffDb,
  companyId: string,
  id: string,
): Promise<{
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> {
  const row = (
    await db
      .select(priceListViewColumns)
      .from(priceLists)
      .where(and(eq(priceLists.companyId, companyId), eq(priceLists.id, id)))
      .limit(1)
      .for("update")
  )[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  return row;
}

/** Lock the list row and return only its id (callers that do not need the view). */
export async function requireLockedPriceListId(
  db: WritableStaffDb,
  companyId: string,
  id: string,
): Promise<string> {
  const row = await requireLockedPriceList(db, companyId, id);
  return row.id;
}
