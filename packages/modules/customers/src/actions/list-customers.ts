import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { likeContainsPattern, paginate } from "@showzy/validation/pagination";
import { and, desc, eq, ilike, lt, or } from "drizzle-orm";

import { countLinkedCounterpartiesByCustomerIds } from "../services/count-linked-counterparties.js";
import { toCustomerView } from "../services/customer-view.js";
import {
  formatListCustomersCursor,
  listCustomersContract,
  parseListCustomersCursor,
} from "./list-customers.contract.js";

const customerListColumns = {
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

export const listCustomers = implementAction(listCustomersContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.listCustomers expects staff");
    }

    const searchPattern =
      input.search === undefined
        ? undefined
        : likeContainsPattern(input.search);
    if (input.search !== undefined && searchPattern === undefined) {
      return { items: [], nextCursor: null };
    }

    const cursor =
      input.cursor === undefined
        ? undefined
        : parseListCustomersCursor(input.cursor);
    if (input.cursor !== undefined && cursor === undefined) {
      throw new CoreInvariantError(
        "listCustomers cursor passed validation but failed to parse",
      );
    }

    const cursorPredicate =
      cursor === undefined
        ? undefined
        : or(
            lt(companyCustomers.updatedAt, new Date(cursor.updatedAt)),
            and(
              eq(companyCustomers.updatedAt, new Date(cursor.updatedAt)),
              lt(companyCustomers.id, cursor.id),
            ),
          );

    const searchPredicate =
      searchPattern === undefined
        ? undefined
        : or(
            ilike(companyCustomers.name, searchPattern),
            ilike(companyCustomers.phone, searchPattern),
            ilike(companyCustomers.email, searchPattern),
          );

    const pageRows = await ctx.db
      .select(customerListColumns)
      .from(companyCustomers)
      .where(
        and(
          eq(companyCustomers.companyId, ctx.companyId),
          input.status === "all"
            ? undefined
            : eq(companyCustomers.status, input.status),
          input.groupId === undefined
            ? undefined
            : eq(companyCustomers.groupId, input.groupId),
          searchPredicate,
          cursorPredicate,
        ),
      )
      .orderBy(desc(companyCustomers.updatedAt), desc(companyCustomers.id))
      .limit(input.limit + 1);

    const { page, nextCursor } = paginate(pageRows, input.limit, (last) =>
      formatListCustomersCursor(last.updatedAt, last.id),
    );

    const linkedByCustomer = await countLinkedCounterpartiesByCustomerIds(
      ctx.db,
      ctx.companyId,
      page.map((row) => row.id),
    );

    return {
      items: page.map((row) =>
        toCustomerView(row, linkedByCustomer.get(row.id) ?? 0),
      ),
      nextCursor,
    };
  },
});
