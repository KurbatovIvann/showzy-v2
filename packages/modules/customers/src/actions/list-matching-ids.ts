import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import { likeContainsPattern } from "@showzy/validation/pagination";
import { and, desc, eq, ilike, or } from "drizzle-orm";

import {
  LIST_MATCHING_IDS_MAX,
  listMatchingIdsContract,
} from "./list-matching-ids.contract.js";

function normalizeMatchQuery(query: string): string {
  return query.normalize("NFC").trim().replace(/\s+/g, " ");
}

export const listMatchingIds = implementAction(listMatchingIdsContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.listMatchingIds expects staff");
    }

    const pattern = likeContainsPattern(normalizeMatchQuery(input.query));
    if (pattern === undefined) {
      return { ids: [], truncated: false };
    }

    const rows = await ctx.db
      .select({ id: companyCustomers.id })
      .from(companyCustomers)
      .where(
        and(
          eq(companyCustomers.companyId, ctx.companyId),
          or(
            ilike(companyCustomers.name, pattern),
            ilike(companyCustomers.phone, pattern),
            ilike(companyCustomers.email, pattern),
          ),
        ),
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
