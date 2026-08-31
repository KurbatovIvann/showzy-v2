import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { optionalNullableUuid } from "@showzy/module-kit/optional-nullable-uuid";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  updateCustomerInputSchema,
  updateCustomerOutputSchema,
} from "../actions/update-customer.contract.js";
import { assertCustomerAssignments } from "./assignments.js";
import { countLinkedCounterparties } from "./count-linked-counterparties.js";
import { mapCustomerWriteError } from "./create-customer.js";
import {
  customerColumns,
  nullableText,
  toCustomerView,
} from "./customer-view.js";
import { lockTenantRow } from "./tenant-row.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type UpdateInput = z.output<typeof updateCustomerInputSchema>;
type CustomerView = z.output<typeof updateCustomerOutputSchema>;

export async function updateStaffCustomer(env: {
  readonly ctx: StaffCtx;
  readonly input: UpdateInput;
}): Promise<CustomerView> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);
  const groupId = optionalNullableUuid(input.groupId);
  const priceListId = optionalNullableUuid(input.priceListId);

  await lockTenantRow(db, companyCustomers, {
    companyId: ctx.companyId,
    id: input.id,
    columns: { id: companyCustomers.id },
  });

  await assertCustomerAssignments({ ctx, groupId, priceListId });

  try {
    const updated = (
      await db
        .update(companyCustomers)
        .set({
          name: input.name,
          phone: nullableText(input.phone),
          email: nullableText(input.email),
          userId: nullableText(input.userId),
          notes: nullableText(input.notes),
          groupId,
          priceListId,
        })
        .where(
          and(
            eq(companyCustomers.companyId, ctx.companyId),
            eq(companyCustomers.id, input.id),
          ),
        )
        .returning(customerColumns)
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "customers.updateCustomer update returned no row",
      );
    }

    const linked = await countLinkedCounterparties(
      db,
      ctx.companyId,
      updated.id,
    );

    ctx.log.info(
      { customer_id: updated.id },
      "customers.updateCustomer updated customer",
    );
    return toCustomerView(updated, linked);
  } catch (error) {
    throw mapCustomerWriteError(error, input.userId);
  }
}
