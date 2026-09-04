import { describe, expect, it } from "vitest";

import {
  LIST_ORDERS_AGGREGATE_BUCKETS_MAX,
  LIST_ORDERS_CURSOR_MAX,
  LIST_ORDERS_CUSTOMER_IDS_MAX,
  LIST_ORDERS_QUERY_MAX,
  LIST_ORDERS_STATUS_BUCKETS_MAX,
  LIST_ORDERS_SUMMARY_DEFAULT_LIMIT,
  LIST_ORDERS_SUMMARY_MAX_LIMIT,
  LIST_ORDERS_WITH_LINES_MAX_LIMIT,
  LIST_ORDERS_WITH_LINES_MAX_LINES,
  UNLINKED_CUSTOMER_NAME_SNAPSHOT,
  listOrderSummaryRowSchema,
  listOrdersAggregateOutputSchema,
  listOrdersBucketSchema,
  listOrdersContract,
  listOrdersInputSchema,
  listOrdersOutputSchema,
  parseListOrdersCursor,
} from "./list.contract.js";

describe("orders.list contract", () => {
  it("is a staff client read with orders:view and discriminated kind", () => {
    expect(listOrdersContract.name).toBe("orders.list");
    expect(listOrdersContract.principal).toBe("staff");
    expect(listOrdersContract.transport).toBe("client");
    expect(listOrdersContract.risk).toBe("read");
    expect(listOrdersContract.permissions).toEqual(["orders:view"]);
    expect(listOrdersContract.aiExposure).toBe("exposed");
    expect(listOrdersContract.audit).toBe(false);
    expect(listOrdersContract.idempotent).toBe(false);
    expect(listOrdersContract.emits).toEqual([]);
    expect(listOrdersContract.timeout).toBe(10_000);
    expect(LIST_ORDERS_SUMMARY_DEFAULT_LIMIT).toBe(20);
    expect(LIST_ORDERS_SUMMARY_MAX_LIMIT).toBe(50);
    expect(LIST_ORDERS_WITH_LINES_MAX_LIMIT).toBe(20);
    expect(LIST_ORDERS_WITH_LINES_MAX_LINES).toBe(200);
    expect(LIST_ORDERS_AGGREGATE_BUCKETS_MAX).toBe(50);
    expect(LIST_ORDERS_STATUS_BUCKETS_MAX).toBe(5);
    expect(LIST_ORDERS_CUSTOMER_IDS_MAX).toBe(50);
    expect(LIST_ORDERS_CURSOR_MAX).toBe(80);
    expect(LIST_ORDERS_QUERY_MAX).toBe(100);
    expect(UNLINKED_CUSTOMER_NAME_SNAPSHOT).toBe("unlinked");
  });

  it("requires kind and defaults page.summary limit and aggregate groupBy", () => {
    expect(listOrdersContract.input.safeParse({}).success).toBe(false);
    expect(listOrdersContract.input.parse({ kind: "page.summary" })).toEqual({
      kind: "page.summary",
      limit: LIST_ORDERS_SUMMARY_DEFAULT_LIMIT,
    });
    expect(listOrdersContract.input.parse({ kind: "aggregate" })).toEqual({
      kind: "aggregate",
      groupBy: "none",
    });
    expect(listOrdersContract.input.parse({ kind: "page.withLines" })).toEqual({
      kind: "page.withLines",
      limit: LIST_ORDERS_WITH_LINES_MAX_LIMIT,
    });
  });

  it("rejects screen-shaped status, active/all aliases, and kind-mismatched fields", () => {
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        status: "all",
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: ["all"] },
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: ["active"] },
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: ["completed"] },
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: [] },
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { customerQuery: "Anna" },
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "aggregate",
        limit: 20,
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        groupBy: "status",
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.withLines",
        limit: LIST_ORDERS_WITH_LINES_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed cursor, oversized limit, and bad filter", () => {
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        cursor: "nope",
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        limit: LIST_ORDERS_SUMMARY_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        limit: 0,
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        filter: { query: "x".repeat(LIST_ORDERS_QUERY_MAX + 1) },
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        filter: { query: "   " },
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        filter: {
          createdFrom: "2026-04-01T00:00:00.000Z",
          createdTo: "2026-01-01T00:00:00.000Z",
        },
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        filter: {
          customerIds: Array.from(
            { length: LIST_ORDERS_CUSTOMER_IDS_MAX + 1 },
            (_, index) =>
              `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
          ),
        },
      }).success,
    ).toBe(false);
    expect(parseListOrdersCursor("nope")).toBeUndefined();
  });

  it("accepts statuses[] single, multi, five CHECK values, and omitted filter", () => {
    expect(
      listOrdersContract.input.parse({
        kind: "page.summary",
        filter: { statuses: ["new"] },
      }).filter?.statuses,
    ).toEqual(["new"]);
    expect(
      listOrdersContract.input.parse({
        kind: "page.summary",
        filter: { statuses: ["new", "confirmed"] },
      }).filter?.statuses,
    ).toEqual(["new", "confirmed"]);
    expect(
      listOrdersContract.input.parse({
        kind: "page.summary",
        filter: { statuses: ["in_progress"] },
      }).filter?.statuses,
    ).toEqual(["in_progress"]);
    expect(
      listOrdersContract.input.parse({
        kind: "page.summary",
        filter: { statuses: ["done"] },
      }).filter?.statuses,
    ).toEqual(["done"]);
    expect(
      listOrdersContract.input.parse({
        kind: "page.summary",
        filter: {
          statuses: ["new", "confirmed", "in_progress", "done", "canceled"],
        },
      }).filter?.statuses,
    ).toEqual(["new", "confirmed", "in_progress", "done", "canceled"]);
    expect(
      listOrdersContract.input.safeParse({
        kind: "page.summary",
        filter: {
          statuses: [
            "new",
            "confirmed",
            "in_progress",
            "done",
            "canceled",
            "new",
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      listOrdersContract.input.parse({ kind: "page.summary" }).filter,
    ).toBeUndefined();
  });

  it("rejects an oversized list-row total as Zod failure (SHO-284 int64 bound)", () => {
    const row = {
      orderId: "11111111-1111-4111-8111-111111111111",
      orderNumber: "A-1",
      customer: {
        nameSnapshot: "Customer A",
        linkedCustomerId: null,
      },
      status: "new" as const,
      itemCount: 1,
      totalGrossMinor: "9223372036854775808",
      currency: "UAH",
      createdAt: "2026-03-01T00:00:00.000Z",
    };
    expect(listOrderSummaryRowSchema.safeParse(row).success).toBe(false);
    expect(
      listOrderSummaryRowSchema.safeParse({
        ...row,
        totalGrossMinor: "199",
      }).success,
    ).toBe(true);
  });

  it("requires quantityMilli only on product aggregate buckets", () => {
    const product = {
      identity: {
        kind: "product" as const,
        productId: "11111111-1111-4111-8111-111111111111",
        variantId: null,
      },
      label: "Widget",
      orderCount: 2,
      grossByCurrency: [{ currency: "UAH", grossAmountMinor: "100" }],
      quantityMilli: "3000",
    };
    expect(listOrdersBucketSchema.parse(product)).toEqual(product);
    expect(
      listOrdersBucketSchema.safeParse({
        identity: product.identity,
        label: product.label,
        orderCount: product.orderCount,
        grossByCurrency: product.grossByCurrency,
      }).success,
    ).toBe(false);
    const status = {
      identity: { kind: "status" as const, status: "new" as const },
      label: "new",
      orderCount: 1,
      grossByCurrency: [{ currency: "UAH", grossAmountMinor: "100" }],
    };
    expect(listOrdersBucketSchema.parse(status)).toEqual(status);
    expect(
      Object.prototype.hasOwnProperty.call(
        listOrdersBucketSchema.parse({ ...status, quantityMilli: "1000" }),
        "quantityMilli",
      ),
    ).toBe(false);
  });

  it("requires statusBuckets on aggregate output and caps at five CHECK statuses", () => {
    const statusBucket = {
      identity: { kind: "status" as const, status: "new" as const },
      label: "new",
      orderCount: 1,
      grossByCurrency: [{ currency: "UAH", grossAmountMinor: "100" }],
    };
    const base = {
      kind: "aggregate" as const,
      orderCount: 1,
      grossByCurrency: [{ currency: "UAH", grossAmountMinor: "100" }],
      buckets: [
        {
          identity: { kind: "none" as const },
          label: "",
          orderCount: 1,
          grossByCurrency: [{ currency: "UAH", grossAmountMinor: "100" }],
        },
      ],
      bucketsTruncated: false,
      customerMatchTruncated: false,
    };
    expect(listOrdersOutputSchema.safeParse(base).success).toBe(false);
    expect(
      listOrdersAggregateOutputSchema.parse({
        ...base,
        statusBuckets: [statusBucket],
      }).statusBuckets,
    ).toEqual([statusBucket]);
    expect(
      listOrdersOutputSchema.safeParse({
        ...base,
        statusBuckets: Array.from(
          { length: LIST_ORDERS_STATUS_BUCKETS_MAX + 1 },
          () => statusBucket,
        ),
      }).success,
    ).toBe(false);
  });
});
