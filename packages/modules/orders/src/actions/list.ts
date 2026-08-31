import { listCustomers } from "@showzy/customers";
import { implementAction, type ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { paginate, sanitizeLikeLiteral } from "@showzy/validation/pagination";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from "drizzle-orm";

import {
  formatListOrdersCursor,
  LIST_ORDERS_CUSTOMER_SEARCH_MAX_PAGES,
  LIST_ORDERS_CUSTOMER_SEARCH_PAGE_SIZE,
  listOrdersContract,
  parseListOrdersCursor,
} from "./list.contract.js";
import { orderStatusSchema } from "./order-view.contract.js";

function parseStatus(value: string): "new" | "confirmed" | "canceled" {
  const parsed = orderStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(`orders row has illegal status "${value}"`);
  }
  return parsed.data;
}

/** Optional leading `#`; empty after strip is not a number match. */
function orderNumberSearchLiteral(literal: string): string | undefined {
  const withoutHash = literal.startsWith("#") ? literal.slice(1) : literal;
  if (withoutHash.length === 0) {
    return undefined;
  }
  return withoutHash;
}

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;

async function customerIdsMatchingSearch(
  ctx: StaffCtx,
  search: string,
): Promise<readonly string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < LIST_ORDERS_CUSTOMER_SEARCH_MAX_PAGES; page += 1) {
    const result = await ctx.call(listCustomers, {
      status: "all",
      search,
      limit: LIST_ORDERS_CUSTOMER_SEARCH_PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    });
    for (const item of result.items) {
      ids.push(item.id);
    }
    if (result.nextCursor === null) {
      return ids;
    }
    cursor = result.nextCursor;
  }
  return ids;
}

function searchPredicate(
  numberLiteral: string | undefined,
  customerIds: readonly string[],
): SQL | undefined {
  const numberMatch =
    numberLiteral === undefined
      ? undefined
      : ilike(orders.orderNumber, `%${numberLiteral}%`);
  const customerMatch =
    customerIds.length === 0
      ? undefined
      : inArray(orders.customerId, [...customerIds]);
  if (numberMatch !== undefined && customerMatch !== undefined) {
    return or(numberMatch, customerMatch);
  }
  return numberMatch ?? customerMatch;
}

export const listOrders = implementAction(listOrdersContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.list expects staff");
    }

    const searchLiteral =
      input.query === undefined ? undefined : sanitizeLikeLiteral(input.query);
    if (input.query !== undefined && searchLiteral === undefined) {
      return { items: [], nextCursor: null };
    }

    const cursor =
      input.cursor === undefined
        ? undefined
        : parseListOrdersCursor(input.cursor);
    if (input.cursor !== undefined && cursor === undefined) {
      throw new CoreInvariantError(
        "listOrders cursor passed validation but failed to parse",
      );
    }

    const numberLiteral =
      searchLiteral === undefined
        ? undefined
        : orderNumberSearchLiteral(searchLiteral);
    const customerIds =
      searchLiteral === undefined
        ? []
        : await customerIdsMatchingSearch(ctx, searchLiteral);
    const queryPredicate =
      searchLiteral === undefined
        ? undefined
        : searchPredicate(numberLiteral, customerIds);
    if (searchLiteral !== undefined && queryPredicate === undefined) {
      return { items: [], nextCursor: null };
    }

    const cursorPredicate =
      cursor === undefined
        ? undefined
        : or(
            lt(orders.createdAt, new Date(cursor.createdAt)),
            and(
              eq(orders.createdAt, new Date(cursor.createdAt)),
              lt(orders.id, cursor.id),
            ),
          );

    const pageRows = await ctx.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        status: orders.status,
        totalGrossMinor: orders.totalGrossMinor,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.companyId, ctx.companyId),
          input.status === "all" ? undefined : eq(orders.status, input.status),
          queryPredicate,
          cursorPredicate,
        ),
      )
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(input.limit + 1);

    const { page, nextCursor } = paginate(pageRows, input.limit, (last) =>
      formatListOrdersCursor(last.createdAt, last.id),
    );

    if (page.length === 0) {
      return { items: [], nextCursor: null };
    }

    const orderIds = page.map((row) => row.id);
    const itemCountRows = await ctx.db
      .select({
        orderId: orderItems.orderId,
        value: count(),
      })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.companyId, ctx.companyId),
          inArray(orderItems.orderId, orderIds),
        ),
      )
      .groupBy(orderItems.orderId);

    const itemCountByOrder = new Map<string, number>();
    for (const row of itemCountRows) {
      itemCountByOrder.set(row.orderId, row.value);
    }

    return {
      items: page.map((row) => ({
        orderId: row.id,
        orderNumber: row.orderNumber,
        customerId: row.customerId,
        status: parseStatus(row.status),
        itemCount: itemCountByOrder.get(row.id) ?? 0,
        totalGrossMinor: moneyToCanonical(row.totalGrossMinor),
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  },
});
