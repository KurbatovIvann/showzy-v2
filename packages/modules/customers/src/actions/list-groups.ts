import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { customerGroups } from "@showzy/db/schema/customers";
import { and, asc, eq, gt, ilike, or } from "drizzle-orm";

import { countActiveMembersByGroupIds } from "../services/count-active-members.js";
import { toGroupView } from "../services/group-view.js";
import {
  formatListGroupsCursor,
  listGroupsContract,
  parseListGroupsCursor,
} from "./list-groups.contract.js";

function nameSearchPattern(query: string): string | undefined {
  const literal = query
    .replaceAll("\\", "")
    .replaceAll("%", "")
    .replaceAll("_", "");
  if (literal.length === 0) {
    return undefined;
  }
  return `%${literal}%`;
}

export const listGroups = implementAction(listGroupsContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.listGroups expects staff");
    }

    const searchPattern =
      input.search === undefined ? undefined : nameSearchPattern(input.search);
    if (input.search !== undefined && searchPattern === undefined) {
      return { items: [], nextCursor: null };
    }

    const cursor =
      input.cursor === undefined
        ? undefined
        : parseListGroupsCursor(input.cursor);
    if (input.cursor !== undefined && cursor === undefined) {
      throw new CoreInvariantError(
        "listGroups cursor passed validation but failed to parse",
      );
    }

    const cursorPredicate =
      cursor === undefined
        ? undefined
        : or(
            gt(customerGroups.sortOrder, cursor.sortOrder),
            and(
              eq(customerGroups.sortOrder, cursor.sortOrder),
              gt(customerGroups.name, cursor.name),
            ),
            and(
              eq(customerGroups.sortOrder, cursor.sortOrder),
              eq(customerGroups.name, cursor.name),
              gt(customerGroups.id, cursor.id),
            ),
          );

    const pageRows = await ctx.db
      .select({
        id: customerGroups.id,
        name: customerGroups.name,
        slug: customerGroups.slug,
        description: customerGroups.description,
        priceListId: customerGroups.priceListId,
        sortOrder: customerGroups.sortOrder,
        createdAt: customerGroups.createdAt,
        updatedAt: customerGroups.updatedAt,
      })
      .from(customerGroups)
      .where(
        and(
          eq(customerGroups.companyId, ctx.companyId),
          searchPattern === undefined
            ? undefined
            : ilike(customerGroups.name, searchPattern),
          cursorPredicate,
        ),
      )
      .orderBy(
        asc(customerGroups.sortOrder),
        asc(customerGroups.name),
        asc(customerGroups.id),
      )
      .limit(input.limit + 1);

    const hasMore = pageRows.length > input.limit;
    const page = hasMore ? pageRows.slice(0, input.limit) : pageRows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? formatListGroupsCursor(last.sortOrder, last.id, last.name)
        : null;

    const memberCountByGroup = await countActiveMembersByGroupIds(
      ctx.db,
      ctx.companyId,
      page.map((row) => row.id),
    );

    return {
      items: page.map((row) =>
        toGroupView(row, memberCountByGroup.get(row.id) ?? 0),
      ),
      nextCursor,
    };
  },
});
