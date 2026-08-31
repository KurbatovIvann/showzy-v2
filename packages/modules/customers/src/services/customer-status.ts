import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { customerViewSchema } from "../actions/customer-view.contract.js";
import { countLinkedCounterparties } from "./count-linked-counterparties.js";
import { customerColumns, toCustomerView } from "./customer-view.js";
import { lockTenantRow } from "./tenant-row.js";
import type { WritableStaffDb } from "./writable.js";

type CustomerView = z.output<typeof customerViewSchema>;

export type CustomerLifecycleStatus = "active" | "archived";

export async function setCustomerStatus(
  db: WritableStaffDb,
  args: {
    companyId: string;
    customerId: string;
    status: CustomerLifecycleStatus;
  },
): Promise<CustomerView> {
  const row = await lockTenantRow(db, companyCustomers, {
    companyId: args.companyId,
    id: args.customerId,
    columns: customerColumns,
  });

  const linked = await countLinkedCounterparties(db, args.companyId, row.id);
  if (row.status === args.status) {
    return toCustomerView(row, linked);
  }

  const updated = (
    await db
      .update(companyCustomers)
      .set({ status: args.status })
      .where(
        and(
          eq(companyCustomers.companyId, args.companyId),
          eq(companyCustomers.id, args.customerId),
        ),
      )
      .returning(customerColumns)
  )[0];
  if (updated === undefined) {
    throw new CoreInvariantError(
      "customers customer status update returned no row",
    );
  }
  return toCustomerView(updated, linked);
}
