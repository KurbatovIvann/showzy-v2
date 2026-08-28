import { companyCustomers } from "@showzy/db/schema/customers";
import { and, count, eq, inArray } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

type GroupMemberCountDb = Pick<WritableStaffDb, "select">;

export async function countActiveGroupMembers(
  db: GroupMemberCountDb,
  companyId: string,
  groupId: string,
): Promise<number> {
  const counts = await countActiveMembersByGroupIds(db, companyId, [groupId]);
  return counts.get(groupId) ?? 0;
}

export async function countActiveMembersByGroupIds(
  db: GroupMemberCountDb,
  companyId: string,
  groupIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (groupIds.length === 0) {
    return result;
  }
  const rows = await db
    .select({
      groupId: companyCustomers.groupId,
      value: count(),
    })
    .from(companyCustomers)
    .where(
      and(
        eq(companyCustomers.companyId, companyId),
        inArray(companyCustomers.groupId, [...groupIds]),
        eq(companyCustomers.status, "active"),
      ),
    )
    .groupBy(companyCustomers.groupId);
  for (const row of rows) {
    if (row.groupId !== null) {
      result.set(row.groupId, row.value);
    }
  }
  return result;
}
