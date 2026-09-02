import { CoreInvariantError } from "@showzy/core/errors";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { paginate } from "@showzy/validation/pagination";
import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";

import {
  formatListOrdersCursor,
  LIST_ORDERS_WITH_LINES_MAX_LINES,
  parseListOrdersCursor,
  type ListOrderCompactLine,
  type ListOrderSummaryRow,
  type ListOrdersInput,
  type ListOrdersOutput,
} from "../../actions/list.contract.js";
import { parseStatus } from "../parse-status.js";
import { headerPredicates, type QueryMatch, type StaffCtx } from "./filter.js";

type ListInput = ListOrdersInput;
type SummaryRow = ListOrderSummaryRow;
type CompactLine = ListOrderCompactLine;
type ListOutput = ListOrdersOutput;

function toSummaryRow(
  row: {
    readonly id: string;
    readonly orderNumber: string;
    readonly customerId: string | null;
    readonly customerNameSnapshot: string;
    readonly status: string;
    readonly totalGrossMinor: bigint;
    readonly currency: string;
    readonly createdAt: Date;
  },
  itemCount: number,
): SummaryRow {
  return {
    orderId: row.id,
    orderNumber: row.orderNumber,
    customer: {
      nameSnapshot: row.customerNameSnapshot,
      linkedCustomerId: row.customerId,
    },
    status: parseStatus(row.status),
    itemCount,
    totalGrossMinor: moneyToCanonical(row.totalGrossMinor),
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

async function itemCountsByOrder(
  ctx: StaffCtx,
  orderIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (orderIds.length === 0) {
    return result;
  }
  const rows = await ctx.db
    .select({
      orderId: orderItems.orderId,
      value: count(),
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.companyId, ctx.companyId),
        inArray(orderItems.orderId, [...orderIds]),
      ),
    )
    .groupBy(orderItems.orderId);
  for (const row of rows) {
    result.set(row.orderId, row.value);
  }
  return result;
}

async function compactLinesByOrder(
  ctx: StaffCtx,
  orderIds: readonly string[],
): Promise<Map<string, CompactLine[]>> {
  const result = new Map<string, CompactLine[]>();
  if (orderIds.length === 0) {
    return result;
  }
  const rows = await ctx.db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      titleSnapshot: orderItems.titleSnapshot,
      quantityMilli: orderItems.quantityMilli,
      grossAmountMinor: orderItems.grossAmountMinor,
      currency: orderItems.currency,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.companyId, ctx.companyId),
        inArray(orderItems.orderId, [...orderIds]),
      ),
    )
    .orderBy(orderItems.createdAt, orderItems.id);
  for (const row of rows) {
    const line: CompactLine = {
      itemId: row.id,
      productId: row.productId,
      variantId: row.variantId,
      titleSnapshot: row.titleSnapshot,
      quantityMilli: moneyToCanonical(row.quantityMilli),
      grossAmountMinor: moneyToCanonical(row.grossAmountMinor),
      currency: row.currency,
    };
    const existing = result.get(row.orderId);
    if (existing === undefined) {
      result.set(row.orderId, [line]);
    } else {
      existing.push(line);
    }
  }
  return result;
}

export async function listPage(
  ctx: StaffCtx,
  input: Extract<ListInput, { kind: "page.summary" | "page.withLines" }>,
  queryMatch: QueryMatch,
): Promise<ListOutput> {
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
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
      customerNameSnapshot: orders.customerNameSnapshot,
      status: orders.status,
      totalGrossMinor: orders.totalGrossMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        ...headerPredicates(ctx, input.filter, queryMatch.predicate),
        cursorPredicate,
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(input.limit + 1);

  const { page, nextCursor } = paginate(pageRows, input.limit, (last) =>
    formatListOrdersCursor(last.createdAt, last.id),
  );

  if (page.length === 0) {
    if (input.kind === "page.withLines") {
      return {
        kind: "page.withLines",
        items: [],
        nextCursor: null,
        customerMatchTruncated: queryMatch.truncated,
        linesTruncated: false,
      };
    }
    return {
      kind: "page.summary",
      items: [],
      nextCursor: null,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  const orderIds = page.map((row) => row.id);
  const itemCountByOrder = await itemCountsByOrder(ctx, orderIds);
  const summaries = page.map((row) =>
    toSummaryRow(row, itemCountByOrder.get(row.id) ?? 0),
  );

  if (input.kind === "page.summary") {
    return {
      kind: "page.summary",
      items: summaries,
      nextCursor,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  const linesByOrder = await compactLinesByOrder(ctx, orderIds);
  let remaining = LIST_ORDERS_WITH_LINES_MAX_LINES;
  let linesTruncated = false;
  const items = summaries.map((summary) => {
    const allLines = linesByOrder.get(summary.orderId) ?? [];
    if (remaining <= 0) {
      if (allLines.length > 0) {
        linesTruncated = true;
      }
      return { ...summary, lines: [] };
    }
    if (allLines.length > remaining) {
      linesTruncated = true;
      const lines = allLines.slice(0, remaining);
      remaining = 0;
      return { ...summary, lines };
    }
    remaining -= allLines.length;
    return { ...summary, lines: allLines };
  });

  return {
    kind: "page.withLines",
    items,
    nextCursor,
    customerMatchTruncated: queryMatch.truncated,
    linesTruncated,
  };
}
