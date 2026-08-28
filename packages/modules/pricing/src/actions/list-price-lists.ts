import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, asc, desc, eq, gt, or } from "drizzle-orm";

import {
  formatListPriceListsCursor,
  listPriceListsContract,
  parseListPriceListsCursor,
} from "./list-price-lists.contract.js";

export const listPriceLists = implementAction(listPriceListsContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("pricing.listPriceLists expects staff");
    }

    const cursor =
      input.cursor === undefined
        ? undefined
        : parseListPriceListsCursor(input.cursor);
    if (input.cursor !== undefined && cursor === undefined) {
      throw new CoreInvariantError(
        "listPriceLists cursor passed validation but failed to parse",
      );
    }

    const cursorPredicate =
      cursor === undefined
        ? undefined
        : or(
            cursor.isDefault ? eq(priceLists.isDefault, false) : undefined,
            and(
              eq(priceLists.isDefault, cursor.isDefault),
              gt(priceLists.name, cursor.name),
            ),
            and(
              eq(priceLists.isDefault, cursor.isDefault),
              eq(priceLists.name, cursor.name),
              gt(priceLists.id, cursor.id),
            ),
          );

    const pageRows = await ctx.db
      .select({
        id: priceLists.id,
        name: priceLists.name,
        isDefault: priceLists.isDefault,
        isActive: priceLists.isActive,
      })
      .from(priceLists)
      .where(and(eq(priceLists.companyId, ctx.companyId), cursorPredicate))
      .orderBy(
        desc(priceLists.isDefault),
        asc(priceLists.name),
        asc(priceLists.id),
      )
      .limit(input.limit + 1);

    const hasMore = pageRows.length > input.limit;
    const page = hasMore ? pageRows.slice(0, input.limit) : pageRows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? formatListPriceListsCursor(last.isDefault, last.id, last.name)
        : null;

    return {
      items: page.map((row) => ({
        id: row.id,
        name: row.name,
        isDefault: row.isDefault,
        isActive: row.isActive,
      })),
      nextCursor,
    };
  },
});
