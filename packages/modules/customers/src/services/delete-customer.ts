import type { ActionCtx } from "@showzy/core";
import {
  CoreInvariantError,
  NotFoundError,
  ValidationError,
} from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type {
  deleteCustomerInputSchema,
  deleteCustomerOutputSchema,
} from "../actions/delete-customer.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DeleteInput = z.output<typeof deleteCustomerInputSchema>;
type DeleteOutput = z.output<typeof deleteCustomerOutputSchema>;

export const ACTIVE_CUSTOMER_DELETE_MESSAGE =
  "The customer must be archived before it can be deleted.";

const archivedCustomerGate = z.object({
  status: z.literal("archived", {
    error: ACTIVE_CUSTOMER_DELETE_MESSAGE,
  }),
});

function requireArchivedStatus(status: string): void {
  const parsed = archivedCustomerGate.safeParse({ status });
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues,
      ACTIVE_CUSTOMER_DELETE_MESSAGE,
    );
  }
}

export async function deleteStaffCustomer(env: {
  readonly ctx: StaffCtx;
  readonly input: DeleteInput;
}): Promise<DeleteOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const existing = (
    await db
      .select({
        id: companyCustomers.id,
        status: companyCustomers.status,
      })
      .from(companyCustomers)
      .where(
        and(
          eq(companyCustomers.companyId, ctx.companyId),
          eq(companyCustomers.id, input.id),
        ),
      )
      .limit(1)
      .for("update")
  )[0];
  if (existing === undefined) {
    throw new NotFoundError();
  }
  requireArchivedStatus(existing.status);

  const deleted = (
    await db
      .delete(companyCustomers)
      .where(
        and(
          eq(companyCustomers.companyId, ctx.companyId),
          eq(companyCustomers.id, input.id),
        ),
      )
      .returning({ id: companyCustomers.id })
  )[0];
  if (deleted === undefined) {
    throw new CoreInvariantError(
      "customers.deleteCustomer delete returned no row",
    );
  }

  ctx.log.info(
    { customer_id: deleted.id },
    "customers.deleteCustomer deleted customer",
  );
  return { id: deleted.id };
}
