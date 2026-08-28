import { companyCustomers } from "@showzy/db/schema/customers";
import { and, count, eq } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

export async function countActiveGroupMembers(
  db: WritableStaffDb,
  companyId: string,
  groupId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(companyCustomers)
    .where(
      and(
        eq(companyCustomers.companyId, companyId),
        eq(companyCustomers.groupId, groupId),
        eq(companyCustomers.status, "active"),
      ),
    );
  return rows[0]?.value ?? 0;
}
