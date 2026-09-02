/**
 * SHO-360 composition: façade maps onto the real `orders.list` contract
 * (not `z.looseObject`). Output mapping runs before clip.
 */
import {
  clipStaffAssistantToolResult,
  CUSTOMER_NAME_MAX,
  LIST_ORDERS_CURSOR_MAX,
  LIST_ORDERS_CUSTOMER_IDS_MAX,
  LIST_ORDERS_QUERY_MAX,
  mapOrdersListCountsInput,
  mapOrdersListCountsOutput,
  mapOrdersListPageInput,
  mapOrdersListPageOutput,
  ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
  ordersListCountsInputSchema,
  ordersListPageInputSchema,
  STAFF_ASSISTANT_CLIP_JSON_MAX,
} from "@showzy/ai";
import { listOrdersContract } from "@showzy/orders/contract";
import { describe, expect, it } from "vitest";

const CLOCK = { now: new Date("2026-09-02T12:00:00.000Z") } as const;
const listOrdersInputSchema = listOrdersContract.input;

const REALISTIC_NAMES = [
  "Катерина Кексова",
  "Микола Коваленко",
  "Олена Петренко",
  "Андрій Шевченко",
  "Ірина Мельник",
  "Сергій Бондаренко",
  "Наталія Ткаченко",
  "Дмитро Кравченко",
  "Марія Ковальчук",
  "Олександр Бондар",
  "Юлія Савченко",
  "Василь Лисенко",
  "Тетяна Романюк",
  "Павло Гриценко",
  "Анна Мороз",
  "Ігор Поліщук",
  "Софія Данилюк",
  "Богдан Кузьменко",
  "Вікторія Остапенко",
  "Роман Гончар",
] as const;

/** Duplicated from `CUSTOMER_NAME_MAX` — do not import `@showzy/validation`. */
const CUSTOMER_NAME_MAX_FIXTURE = 120;
const MAX_CUSTOMER_NAME = "к".repeat(CUSTOMER_NAME_MAX_FIXTURE);

function uuid(index: number, prefix: string): string {
  return `${prefix}-${index.toString().padStart(12, "0")}`;
}

function fatSummaryRow(index: number, nameSnapshot?: string) {
  const name =
    nameSnapshot ??
    REALISTIC_NAMES[index % REALISTIC_NAMES.length] ??
    "Customer";
  return {
    orderId: uuid(index + 1, "aaaaaaaa-aaaa-4aaa-8aaa"),
    orderNumber: `KA-${String(1040 + index)}`,
    customer: {
      nameSnapshot: name,
      linkedCustomerId: uuid(index + 1, "bbbbbbbb-bbbb-4bbb-8bbb"),
    },
    status: (["new", "confirmed", "canceled"] as const)[index % 3],
    itemCount: (index % 7) + 1,
    totalGrossMinor: String(125_000 + index * 1_370),
    currency: "UAH",
    createdAt: new Date(Date.UTC(2026, 8, 2, 8, index, 0)).toISOString(),
    comment: "handler-only",
    totalNetMinor: "1",
  };
}

function productBucket(index: number) {
  return {
    identity: {
      kind: "product" as const,
      productId: uuid(index + 1, "aaaaaaaa-aaaa-4aaa-8aaa"),
      variantId: uuid(index + 1, "bbbbbbbb-bbbb-4bbb-8bbb"),
    },
    label: `Насіння ${REALISTIC_NAMES[index % REALISTIC_NAMES.length] ?? "SKU"}`,
    orderCount: 50 - index,
    extra: true,
    grossByCurrency: [
      { currency: "UAH", grossAmountMinor: String(1_500_000 + index) },
    ],
    quantityMilli: String(12_000 + index * 100),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visiblePageItems(mapped: unknown): unknown[] {
  if (!isRecord(mapped) || !Array.isArray(mapped["items"])) {
    return [];
  }
  return mapped["items"];
}

describe("orders list façade ↔ orders.list contract (SHO-360)", () => {
  it("maps every page façade input onto listOrdersInputSchema", () => {
    const cases = [
      {},
      { statuses: ["new", "confirmed"] as const },
      { query: "Катерина", customerIds: [uuid(1, "aaaaaaaa-aaaa-4aaa-8aaa")] },
      {
        createdFrom: "2026-08-30T21:00:00.000Z",
        createdTo: "2026-09-06T20:59:59.999Z",
      },
      { period: "today" as const },
      { period: "this_week" as const },
      { period: "this_month" as const },
      {
        cursor: "2026-09-02T08:00:00.000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      },
    ];
    for (const input of cases) {
      const parsed = ordersListPageInputSchema.parse(input);
      const canonical = mapOrdersListPageInput(parsed, CLOCK);
      expect(listOrdersInputSchema.parse(canonical)).toEqual(canonical);
    }
  });

  it("maps every counts façade input onto listOrdersInputSchema", () => {
    const cases = [
      {},
      { groupBy: "none" as const },
      { groupBy: "product" as const, statuses: ["new"] as const },
      { query: "  Катерина  " },
      { customerIds: [uuid(1, "aaaaaaaa-aaaa-4aaa-8aaa")] },
      { period: "this_week" as const, groupBy: "none" as const },
      {
        createdFrom: "2026-08-30T21:00:00.000Z",
        createdTo: "2026-09-06T20:59:59.999Z",
        query: "Katya",
      },
    ];
    for (const input of cases) {
      const parsed = ordersListCountsInputSchema.parse(input);
      const canonical = mapOrdersListCountsInput(parsed, CLOCK);
      expect(listOrdersInputSchema.parse(canonical)).toEqual(canonical);
    }
  });

  it("duplicates query, cursor, customerIds, and status caps from the contract", () => {
    // `@showzy/orders/contract` exports the action, not the cap numbers.
    // These must match `list.contract.ts` (`LIST_ORDERS_*` = 100 / 80 / 50).
    expect(LIST_ORDERS_QUERY_MAX).toBe(100);
    expect(LIST_ORDERS_CURSOR_MAX).toBe(80);
    expect(LIST_ORDERS_CUSTOMER_IDS_MAX).toBe(50);
    expect(CUSTOMER_NAME_MAX).toBe(CUSTOMER_NAME_MAX_FIXTURE);
    expect(ORDERS_LIST_PAGE_ASSISTANT_LIMIT).toBe(9);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { query: "q".repeat(LIST_ORDERS_QUERY_MAX) },
      }).success,
    ).toBe(true);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { query: "q".repeat(LIST_ORDERS_QUERY_MAX + 1) },
      }).success,
    ).toBe(false);
    expect(
      ordersListPageInputSchema.safeParse({
        query: "q".repeat(LIST_ORDERS_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        cursor: "c".repeat(LIST_ORDERS_CURSOR_MAX + 1),
      }).success,
    ).toBe(false);
    const oversized = Array.from(
      { length: LIST_ORDERS_CUSTOMER_IDS_MAX + 1 },
      (_, index) => uuid(index + 1, "11111111-1111-4111-8111"),
    );
    expect(
      listOrdersInputSchema.safeParse({
        kind: "aggregate",
        filter: { customerIds: oversized },
      }).success,
    ).toBe(false);
    expect(
      ordersListCountsInputSchema.safeParse({ customerIds: oversized }).success,
    ).toBe(false);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: ["new", "confirmed", "canceled"] },
      }).success,
    ).toBe(true);
    expect(
      listOrdersInputSchema.safeParse({
        kind: "page.summary",
        filter: { statuses: ["active"] },
      }).success,
    ).toBe(false);
    expect(
      ordersListPageInputSchema.safeParse({ statuses: ["active"] }).success,
    ).toBe(false);
  });

  it("keeps name, gross, currency, status, and date on every visible max-name compact row without a cursor skip hole", () => {
    const fat20 = Array.from({ length: 20 }, (_, index) =>
      fatSummaryRow(index),
    );
    const mapped20 = mapOrdersListPageOutput({
      kind: "page.summary",
      items: fat20,
      nextCursor: "after-20",
      customerMatchTruncated: false,
    });
    expect(JSON.stringify(mapped20).length).toBeGreaterThan(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );

    const fatPage = Array.from(
      { length: ORDERS_LIST_PAGE_ASSISTANT_LIMIT },
      (_, index) => fatSummaryRow(index, MAX_CUSTOMER_NAME),
    );
    const nextCursor = "n".repeat(LIST_ORDERS_CURSOR_MAX);
    const mapped = mapOrdersListPageOutput({
      kind: "page.summary",
      items: fatPage,
      nextCursor,
      customerMatchTruncated: false,
    });
    expect(JSON.stringify(mapped).length).toBeLessThanOrEqual(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );
    const oneOver = mapOrdersListPageOutput({
      kind: "page.summary",
      items: Array.from(
        { length: ORDERS_LIST_PAGE_ASSISTANT_LIMIT + 1 },
        (_, index) => fatSummaryRow(index, MAX_CUSTOMER_NAME),
      ),
      nextCursor,
      customerMatchTruncated: false,
    });
    expect(JSON.stringify(oneOver).length).toBeGreaterThan(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );

    const clipped = clipStaffAssistantToolResult(mapped);
    expect(clipped).toBe(mapped);
    const items = visiblePageItems(clipped);
    expect(items).toHaveLength(ORDERS_LIST_PAGE_ASSISTANT_LIMIT);
    for (const [index, row] of items.entries()) {
      expect(isRecord(row)).toBe(true);
      if (!isRecord(row) || !isRecord(row["customer"])) {
        continue;
      }
      expect(row["customer"]["nameSnapshot"]).toBe(MAX_CUSTOMER_NAME);
      expect(String(row["customer"]["nameSnapshot"]).length).toBe(
        CUSTOMER_NAME_MAX_FIXTURE,
      );
      expect(row["totalGrossMinor"]).toBe(fatPage[index]?.totalGrossMinor);
      expect(row["currency"]).toBe("UAH");
      expect(row["status"]).toBe(fatPage[index]?.status);
      expect(row["createdAt"]).toBe(fatPage[index]?.createdAt);
    }
    expect(isRecord(clipped) && clipped["nextCursor"]).toBe(nextCursor);
  });

  it("keeps orderCount and every grossByCurrency.grossAmountMinor on a 50-bucket compact aggregate", () => {
    const buckets = Array.from({ length: 50 }, (_, index) =>
      productBucket(index),
    );
    const grossByCurrency = [
      { currency: "UAH", grossAmountMinor: "99000000" },
      { currency: "USD", grossAmountMinor: "120000" },
    ];
    const mapped = mapOrdersListCountsOutput({
      kind: "aggregate",
      orderCount: 400,
      grossByCurrency,
      buckets,
      bucketsTruncated: true,
      customerMatchTruncated: false,
    });
    const clipped = clipStaffAssistantToolResult(mapped);
    expect(isRecord(clipped)).toBe(true);
    if (!isRecord(clipped)) {
      return;
    }
    expect(clipped["orderCount"]).toBe(400);
    expect(clipped["grossByCurrency"]).toEqual(grossByCurrency);
    for (const row of Array.isArray(clipped["grossByCurrency"])
      ? clipped["grossByCurrency"]
      : []) {
      expect(isRecord(row)).toBe(true);
      if (!isRecord(row)) {
        continue;
      }
      expect(typeof row["grossAmountMinor"]).toBe("string");
      expect(row["currency"]).toEqual(expect.any(String));
    }
    expect(Array.isArray(clipped["buckets"])).toBe(true);
    const kept = Array.isArray(clipped["buckets"]) ? clipped["buckets"] : [];
    if (kept.length < 50) {
      expect(clipped["bucketsOmitted"]).toBe(50 - kept.length);
      const compactPrefix = buckets.slice(0, kept.length).map((row) => ({
        identity: {
          kind: "product" as const,
          productId: row.identity.productId,
          variantId: row.identity.variantId,
        },
        label: row.label,
        orderCount: row.orderCount,
        grossByCurrency: row.grossByCurrency,
        quantityMilli: row.quantityMilli,
      }));
      expect(kept).toEqual(compactPrefix);
    }
    expect(JSON.stringify(clipped).length).toBeLessThanOrEqual(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );
  });
});
