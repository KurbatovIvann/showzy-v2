import { implementAction } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";

import { countLinkedCounterparties } from "../services/count-linked-counterparties.js";
import { toCustomerView } from "../services/customer-view.js";
import { getCustomerContract } from "./get-customer.contract.js";

export const getCustomer = implementAction(getCustomerContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.getCustomer expects staff");
    }

    const row = (
      await ctx.db
        .select({
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
        .from(companyCustomers)
        .where(
          and(
            eq(companyCustomers.companyId, ctx.companyId),
            eq(companyCustomers.id, input.id),
          ),
        )
        .limit(1)
    )[0];
    if (row === undefined) {
      throw new NotFoundError();
    }

    const linked = await countLinkedCounterparties(
      ctx.db,
      ctx.companyId,
      row.id,
    );
    return toCustomerView(row, linked);
  },
});
