import type { ActionCtx } from "@showzy/core";
import { ValidationError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import type { z } from "zod";

import type {
  deleteCustomerInputSchema,
  deleteCustomerOutputSchema,
} from "../actions/delete-customer.contract.js";
import { deleteTenantRow, lockTenantRow } from "./tenant-row.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DeleteInput = z.output<typeof deleteCustomerInputSchema>;
type DeleteOutput = z.output<typeof deleteCustomerOutputSchema>;

export const ACTIVE_CUSTOMER_DELETE_MESSAGE =
  "The customer must be archived before it can be deleted.";

function requireArchivedStatus(status: string): void {
  if (status === "archived") {
    return;
  }
  const issue: z.core.$ZodIssue = {
    code: "invalid_value",
    path: ["status"],
    message: ACTIVE_CUSTOMER_DELETE_MESSAGE,
    input: status,
    values: ["archived"],
  };
  throw new ValidationError([issue], ACTIVE_CUSTOMER_DELETE_MESSAGE);
}

export async function deleteStaffCustomer(env: {
  readonly ctx: StaffCtx;
  readonly input: DeleteInput;
}): Promise<DeleteOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const existing = await lockTenantRow(db, companyCustomers, {
    companyId: ctx.companyId,
    id: input.id,
    columns: {
      id: companyCustomers.id,
      status: companyCustomers.status,
    },
  });
  requireArchivedStatus(existing.status);

  const deleted = await deleteTenantRow(db, companyCustomers, {
    companyId: ctx.companyId,
    id: input.id,
    lostRowMessage: "customers.deleteCustomer delete returned no row",
  });

  ctx.log.info(
    { customer_id: deleted.id },
    "customers.deleteCustomer deleted customer",
  );
  return { id: deleted.id };
}
