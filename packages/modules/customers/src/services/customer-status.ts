import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { and, count, eq } from "drizzle-orm";
import type { z } from "zod";

import type { customerViewSchema } from "../actions/customer-view.contract.js";
import { toCustomerView } from "./customer-view.js";
import type { WritableStaffDb } from "./writable.js";

type CustomerView = z.output<typeof customerViewSchema>;

export type CustomerLifecycleStatus = "active" | "archived";

const customerViewColumns = {
  id: companyCustomers.id,
  name: companyCustomers.name,
  phone: companyCustomers.phone,
  email: companyCustomers.email,
  userId: companyCustomers.userId,
  notes: companyCustomers.notes,
  groupId: companyCustomers.groupId,
  priceListId: companyCustomers.priceListId,
  status: companyCustomers.status,
  createdAt: companyCustomers.createdAt,
  updatedAt: companyCustomers.updatedAt,
};

async function countLinkedCounterparties(
  db: WritableStaffDb,
  args: { companyId: string; customerId: string },
): Promise<number> {
  const linked = (
    await db
      .select({ value: count() })
      .from(counterparties)
      .where(
        and(
          eq(counterparties.companyId, args.companyId),
          eq(counterparties.customerId, args.customerId),
        ),
      )
  )[0];
  return linked?.value ?? 0;
}

export async function setCustomerStatus(
  db: WritableStaffDb,
  args: {
    companyId: string;
    customerId: string;
    status: CustomerLifecycleStatus;
  },
): Promise<CustomerView> {
  const rows = await db
    .select(customerViewColumns)
    .from(companyCustomers)
    .where(
      and(
        eq(companyCustomers.companyId, args.companyId),
        eq(companyCustomers.id, args.customerId),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const linked = await countLinkedCounterparties(db, {
    companyId: args.companyId,
    customerId: row.id,
  });
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
      .returning(customerViewColumns)
  )[0];
  if (updated === undefined) {
    throw new CoreInvariantError(
      "customers customer status update returned no row",
    );
  }
  return toCustomerView(updated, linked);
}
