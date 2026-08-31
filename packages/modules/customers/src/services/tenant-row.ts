import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import {
  companyCustomers,
  counterparties,
  customerGroups,
} from "@showzy/db/schema/customers";
import { and, eq, type InferColumnsDataTypes } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import type { WritableStaffDb } from "./writable.js";

type CustomerTenantTable =
  typeof companyCustomers | typeof customerGroups | typeof counterparties;

type ForUpdateQuery<TRow> = {
  for: (strength: "update") => Promise<TRow[]>;
};

function tenantRowWhere(
  table: CustomerTenantTable,
  companyId: string,
  id: string,
) {
  return and(eq(table.companyId, companyId), eq(table.id, id));
}

export async function lockTenantRow<TColumns extends Record<string, PgColumn>>(
  db: Pick<WritableStaffDb, "select">,
  table: CustomerTenantTable,
  args: {
    readonly companyId: string;
    readonly id: string;
    readonly columns: TColumns;
  },
): Promise<InferColumnsDataTypes<TColumns>> {
  const locked = db
    .select(args.columns)
    .from(table)
    .where(tenantRowWhere(table, args.companyId, args.id))
    .limit(1) as ForUpdateQuery<InferColumnsDataTypes<TColumns>>;
  const row = (await locked.for("update"))[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  return row;
}

export async function deleteTenantRow(
  db: Pick<WritableStaffDb, "delete">,
  table: CustomerTenantTable,
  args: {
    readonly companyId: string;
    readonly id: string;
    readonly lostRowMessage: string;
  },
): Promise<{ id: string }> {
  const deleted = (
    await db
      .delete(table)
      .where(tenantRowWhere(table, args.companyId, args.id))
      .returning({ id: table.id })
  )[0];
  if (deleted === undefined || typeof deleted.id !== "string") {
    throw new CoreInvariantError(args.lostRowMessage);
  }
  return { id: deleted.id };
}
