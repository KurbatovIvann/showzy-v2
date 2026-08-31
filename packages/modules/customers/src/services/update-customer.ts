import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { optionalNullableUuid } from "@showzy/module-kit/optional-nullable-uuid";
import { and, count, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  updateCustomerInputSchema,
  updateCustomerOutputSchema,
} from "../actions/update-customer.contract.js";
import { assertCustomerAssignments } from "./assignments.js";
import { mapCustomerWriteError } from "./create-customer.js";
import { nullableText, toCustomerView } from "./customer-view.js";
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

  const existing = (
    await db
      .select({ id: companyCustomers.id })
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
        .returning({
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
        })
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "customers.updateCustomer update returned no row",
      );
    }

    const linked = (
      await db
        .select({ value: count() })
        .from(counterparties)
        .where(
          and(
            eq(counterparties.companyId, ctx.companyId),
            eq(counterparties.customerId, updated.id),
          ),
        )
    )[0];

    ctx.log.info(
      { customer_id: updated.id },
      "customers.updateCustomer updated customer",
    );
    return toCustomerView(updated, linked?.value ?? 0);
  } catch (error) {
    throw mapCustomerWriteError(error, input.userId);
  }
}
