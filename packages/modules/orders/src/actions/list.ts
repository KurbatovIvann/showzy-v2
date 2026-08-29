import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";

import { moneyToCanonical } from "../services/canonical.js";
import {
  formatListOrdersCursor,
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

export const listOrders = implementAction(listOrdersContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.list expects staff");
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
          cursorPredicate,
        ),
      )
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(input.limit + 1);

    const hasMore = pageRows.length > input.limit;
    const page = hasMore ? pageRows.slice(0, input.limit) : pageRows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? formatListOrdersCursor(last.createdAt, last.id)
        : null;

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
