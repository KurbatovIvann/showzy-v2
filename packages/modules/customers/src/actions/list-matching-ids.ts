import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { and, desc, eq } from "drizzle-orm";

import { customerListSearchPredicate } from "../services/customer-list-search.js";
import {
  LIST_MATCHING_IDS_MAX,
  listMatchingIdsContract,
} from "./list-matching-ids.contract.js";

export const listMatchingIds = implementAction(listMatchingIdsContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.listMatchingIds expects staff");
    }

    const searchPredicate = customerListSearchPredicate(input.query);
    if (searchPredicate === undefined) {
      return { ids: [], truncated: false };
    }

    const rows = await ctx.db
      .select({ id: companyCustomers.id })
      .from(companyCustomers)
      .where(
        and(eq(companyCustomers.companyId, ctx.companyId), searchPredicate),
      )
      .orderBy(desc(companyCustomers.updatedAt), desc(companyCustomers.id))
      .limit(LIST_MATCHING_IDS_MAX + 1);

    const truncated = rows.length > LIST_MATCHING_IDS_MAX;
    const page = truncated ? rows.slice(0, LIST_MATCHING_IDS_MAX) : rows;
    return {
      ids: page.map((row) => row.id),
      truncated,
    };
  },
});
