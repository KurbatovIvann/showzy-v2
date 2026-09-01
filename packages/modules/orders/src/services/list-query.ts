import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { listMatchingIds } from "@showzy/customers";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { paginate, sanitizeLikeLiteral } from "@showzy/validation/pagination";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";

import {
  formatListOrdersCursor,
  LIST_ORDERS_AGGREGATE_BUCKETS_MAX,
  LIST_ORDERS_WITH_LINES_MAX_LINES,
  parseListOrdersCursor,
  type ListOrderCompactLine,
  type ListOrderSummaryRow,
  type ListOrdersBucket,
  type ListOrdersFilter,
  type ListOrdersGrossByCurrency,
  type ListOrdersInput,
  type ListOrdersOutput,
} from "../actions/list.contract.js";
import { parseStatus } from "./parse-status.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type ListInput = ListOrdersInput;
type ListFilter = ListOrdersFilter;
type SummaryRow = ListOrderSummaryRow;
type CompactLine = ListOrderCompactLine;
type GrossByCurrency = ListOrdersGrossByCurrency;
type Bucket = ListOrdersBucket;
type ListOutput = ListOrdersOutput;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function toBigint(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }
  return 0n;
}

function toCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.length > 0) {
    return Number(value);
  }
  return 0;
}

function orderNumberSearchLiteral(literal: string): string | undefined {
  const withoutHash = literal.startsWith("#") ? literal.slice(1) : literal;
  if (withoutHash.length === 0) {
    return undefined;
  }
  return withoutHash;
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

async function resolveQueryMatch(
  ctx: StaffCtx,
  query: string | undefined,
): Promise<{
  readonly predicate: SQL | undefined;
  readonly truncated: boolean;
  readonly empty: boolean;
}> {
  if (query === undefined) {
    return { predicate: undefined, truncated: false, empty: false };
  }
  const searchLiteral = sanitizeLikeLiteral(query);
  const matching = await ctx.call(listMatchingIds, { query });
  const numberLiteral =
    searchLiteral === undefined
      ? undefined
      : orderNumberSearchLiteral(searchLiteral);
  const predicate = searchPredicate(numberLiteral, matching.ids);
  return {
    predicate,
    truncated: matching.truncated,
    empty: predicate === undefined,
  };
}

function headerPredicates(
  ctx: StaffCtx,
  filter: ListFilter | undefined,
  queryPredicate: SQL | undefined,
): SQL[] {
  const parts: SQL[] = [eq(orders.companyId, ctx.companyId)];
  if (filter?.statuses !== undefined) {
    parts.push(inArray(orders.status, unique(filter.statuses)));
  }
  if (filter?.customerIds !== undefined) {
    parts.push(inArray(orders.customerId, unique(filter.customerIds)));
  }
  if (filter?.createdFrom !== undefined) {
    parts.push(gte(orders.createdAt, new Date(filter.createdFrom)));
  }
  if (filter?.createdTo !== undefined) {
    parts.push(lte(orders.createdAt, new Date(filter.createdTo)));
  }
  if (queryPredicate !== undefined) {
    parts.push(queryPredicate);
  }
  return parts;
}

function mergeGross(
  into: Map<string, bigint>,
  currency: string,
  amount: bigint,
): void {
  into.set(currency, (into.get(currency) ?? 0n) + amount);
}

function grossByCurrencyFromMap(
  amounts: Map<string, bigint>,
): GrossByCurrency[] {
  return [...amounts.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({
      currency,
      grossAmountMinor: moneyToCanonical(amount),
    }));
}

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

async function listPage(
  ctx: StaffCtx,
  input: Extract<ListInput, { kind: "page.summary" | "page.withLines" }>,
  queryMatch: {
    readonly predicate: SQL | undefined;
    readonly truncated: boolean;
  },
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

type MutableBucket = {
  identity: Bucket["identity"];
  label: string;
  sortKey: string;
  newestAt: number;
  newestId: string;
  orderCount: number;
  gross: Map<string, bigint>;
};

function addGrossRow(
  bucket: MutableBucket,
  currency: string,
  amount: bigint,
  createdAt: Date,
  orderId: string,
  label: string,
): void {
  mergeGross(bucket.gross, currency, amount);
  const at = createdAt.getTime();
  if (
    at > bucket.newestAt ||
    (at === bucket.newestAt && orderId > bucket.newestId)
  ) {
    bucket.newestAt = at;
    bucket.newestId = orderId;
    bucket.label = label;
  }
}

function sortAndCapBuckets(buckets: MutableBucket[]): {
  readonly buckets: Bucket[];
  readonly bucketsTruncated: boolean;
} {
  const sorted = buckets.toSorted((left, right) => {
    if (left.orderCount !== right.orderCount) {
      return right.orderCount - left.orderCount;
    }
    return left.sortKey.localeCompare(right.sortKey);
  });
  const truncated = sorted.length > LIST_ORDERS_AGGREGATE_BUCKETS_MAX;
  const capped = truncated
    ? sorted.slice(0, LIST_ORDERS_AGGREGATE_BUCKETS_MAX)
    : sorted;
  return {
    bucketsTruncated: truncated,
    buckets: capped.map((bucket) => ({
      identity: bucket.identity,
      label: bucket.label,
      orderCount: bucket.orderCount,
      grossByCurrency: grossByCurrencyFromMap(bucket.gross),
    })),
  };
}

async function listAggregate(
  ctx: StaffCtx,
  input: Extract<ListInput, { kind: "aggregate" }>,
  queryMatch: {
    readonly predicate: SQL | undefined;
    readonly truncated: boolean;
  },
): Promise<ListOutput> {
  const where = and(
    ...headerPredicates(ctx, input.filter, queryMatch.predicate),
  );
  const totals = await ctx.db
    .select({
      currency: orders.currency,
      orderCount: count(),
      grossMinor: sum(orders.totalGrossMinor),
    })
    .from(orders)
    .where(where)
    .groupBy(orders.currency);

  const totalGross = new Map<string, bigint>();
  let orderCount = 0;
  for (const row of totals) {
    orderCount += toCount(row.orderCount);
    mergeGross(totalGross, row.currency, toBigint(row.grossMinor));
  }
  const grossByCurrency = grossByCurrencyFromMap(totalGross);

  if (input.groupBy === "none") {
    return {
      kind: "aggregate",
      orderCount,
      grossByCurrency,
      buckets: [
        {
          identity: { kind: "none" },
          label: "",
          orderCount,
          grossByCurrency,
        },
      ],
      bucketsTruncated: false,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  if (input.groupBy === "status") {
    const rows = await ctx.db
      .select({
        status: orders.status,
        currency: orders.currency,
        orderCount: count(),
        grossMinor: sum(orders.totalGrossMinor),
        newestAt: sql<Date>`max(${orders.createdAt})`,
        newestId: sql<string>`(array_agg(${orders.id} ORDER BY ${orders.createdAt} DESC, ${orders.id} DESC))[1]`,
      })
      .from(orders)
      .where(where)
      .groupBy(orders.status, orders.currency);

    const byStatus = new Map<string, MutableBucket>();
    for (const row of rows) {
      const status = parseStatus(row.status);
      const existing = byStatus.get(status);
      const bucket =
        existing ??
        ({
          identity: { kind: "status", status },
          label: status,
          sortKey: status,
          newestAt: 0,
          newestId: "",
          orderCount: 0,
          gross: new Map(),
        } satisfies MutableBucket);
      bucket.orderCount += toCount(row.orderCount);
      addGrossRow(
        bucket,
        row.currency,
        toBigint(row.grossMinor),
        new Date(row.newestAt),
        row.newestId,
        status,
      );
      byStatus.set(status, bucket);
    }
    const capped = sortAndCapBuckets([...byStatus.values()]);
    return {
      kind: "aggregate",
      orderCount,
      grossByCurrency,
      buckets: capped.buckets,
      bucketsTruncated: capped.bucketsTruncated,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  if (input.groupBy === "customer") {
    const rows = await ctx.db
      .select({
        customerId: orders.customerId,
        nameSnapshot: orders.customerNameSnapshot,
        currency: orders.currency,
        orderCount: count(),
        grossMinor: sum(orders.totalGrossMinor),
        newestAt: sql<Date>`max(${orders.createdAt})`,
        newestId: sql<string>`(array_agg(${orders.id} ORDER BY ${orders.createdAt} DESC, ${orders.id} DESC))[1]`,
        newestName: sql<string>`(array_agg(${orders.customerNameSnapshot} ORDER BY ${orders.createdAt} DESC, ${orders.id} DESC))[1]`,
      })
      .from(orders)
      .where(where)
      .groupBy(orders.customerId, orders.customerNameSnapshot, orders.currency);

    const byCustomer = new Map<string, MutableBucket>();
    for (const row of rows) {
      const identityKey =
        row.customerId === null
          ? `name:${row.nameSnapshot}`
          : `id:${row.customerId}`;
      const existing = byCustomer.get(identityKey);
      const label = row.newestName;
      const bucket =
        existing ??
        ({
          identity: {
            kind: "customer",
            customerId: row.customerId,
            nameSnapshot: label,
          },
          label,
          sortKey: identityKey,
          newestAt: 0,
          newestId: "",
          orderCount: 0,
          gross: new Map(),
        } satisfies MutableBucket);
      bucket.orderCount += toCount(row.orderCount);
      addGrossRow(
        bucket,
        row.currency,
        toBigint(row.grossMinor),
        new Date(row.newestAt),
        row.newestId,
        label,
      );
      if (bucket.identity.kind === "customer") {
        bucket.identity = {
          kind: "customer",
          customerId: bucket.identity.customerId,
          nameSnapshot: bucket.label,
        };
      }
      byCustomer.set(identityKey, bucket);
    }
    const capped = sortAndCapBuckets([...byCustomer.values()]);
    return {
      kind: "aggregate",
      orderCount,
      grossByCurrency,
      buckets: capped.buckets,
      bucketsTruncated: capped.bucketsTruncated,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  const productRows = await ctx.db
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      currency: orderItems.currency,
      orderCount: sql<number>`count(distinct ${orderItems.orderId})`,
      grossMinor: sum(orderItems.grossAmountMinor),
      newestAt: sql<Date>`max(${orders.createdAt})`,
      newestId: sql<string>`(array_agg(${orders.id} ORDER BY ${orders.createdAt} DESC, ${orders.id} DESC))[1]`,
      newestTitle: sql<string>`(array_agg(${orderItems.titleSnapshot} ORDER BY ${orders.createdAt} DESC, ${orders.id} DESC))[1]`,
    })
    .from(orderItems)
    .innerJoin(
      orders,
      and(
        eq(orders.companyId, orderItems.companyId),
        eq(orders.id, orderItems.orderId),
      ),
    )
    .where(and(where, eq(orderItems.companyId, ctx.companyId)))
    .groupBy(orderItems.productId, orderItems.variantId, orderItems.currency);

  const byProduct = new Map<string, MutableBucket>();
  for (const row of productRows) {
    const variantKey = row.variantId ?? "";
    const identityKey = `product:${row.productId}:${variantKey}`;
    const existing = byProduct.get(identityKey);
    const label = row.newestTitle;
    const bucket =
      existing ??
      ({
        identity: {
          kind: "product",
          productId: row.productId,
          variantId: row.variantId,
        },
        label,
        sortKey: identityKey,
        newestAt: 0,
        newestId: "",
        orderCount: 0,
        gross: new Map(),
      } satisfies MutableBucket);
    bucket.orderCount += toCount(row.orderCount);
    addGrossRow(
      bucket,
      row.currency,
      toBigint(row.grossMinor),
      new Date(row.newestAt),
      row.newestId,
      label,
    );
    byProduct.set(identityKey, bucket);
  }
  const capped = sortAndCapBuckets([...byProduct.values()]);
  return {
    kind: "aggregate",
    orderCount,
    grossByCurrency,
    buckets: capped.buckets,
    bucketsTruncated: capped.bucketsTruncated,
    customerMatchTruncated: queryMatch.truncated,
  };
}

export async function executeListOrders(
  input: ListInput,
  ctx: StaffCtx,
): Promise<ListOutput> {
  const queryMatch = await resolveQueryMatch(ctx, input.filter?.query);
  if (queryMatch.empty) {
    if (input.kind === "aggregate") {
      return {
        kind: "aggregate",
        orderCount: 0,
        grossByCurrency: [],
        buckets:
          input.groupBy === "none"
            ? [
                {
                  identity: { kind: "none" },
                  label: "",
                  orderCount: 0,
                  grossByCurrency: [],
                },
              ]
            : [],
        bucketsTruncated: false,
        customerMatchTruncated: queryMatch.truncated,
      };
    }
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

  if (input.kind === "aggregate") {
    return listAggregate(ctx, input, queryMatch);
  }
  return listPage(ctx, input, queryMatch);
}
