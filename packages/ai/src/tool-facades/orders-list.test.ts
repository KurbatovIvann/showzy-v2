import { defineActionContract } from "@showzy/core/contract";
import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clipStaffAssistantToolResult,
  STAFF_ASSISTANT_CLIP_JSON_MAX,
  STAFF_ASSISTANT_CLIPPED_STATUS,
} from "../clip-tool-result.js";
import { STAFF_ASSISTANT_CONFIRMATION_STATUS } from "../confirmation.js";
import {
  LIST_ORDERS_CURSOR_MAX,
  LIST_ORDERS_CUSTOMER_IDS_MAX,
  LIST_ORDERS_QUERY_MAX,
  mapOrdersListCountsInput,
  mapOrdersListCountsOutput,
  mapOrdersListPageInput,
  mapOrdersListPageOutput,
  ORDERS_LIST_ACTION_NAME,
  ORDERS_LIST_COUNTS_TOOL_NAME,
  ORDERS_LIST_CUSTOMER_IDS_MAX,
  ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
  ORDERS_LIST_PAGE_TOOL_NAME,
  ordersListCountsInputSchema,
  ordersListFacadeTools,
  ordersListPageInputSchema,
} from "./orders-list.js";

const listOrders = defineActionContract({
  name: "orders.list",
  description:
    "Query staff-intake orders in the staff member's active company.",
  principal: "staff",
  transport: "client",
  aiExposure: "exposed",
  permissions: ["orders:view"],
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 10_000,
  input: z.looseObject({}),
  output: z.object({ kind: z.string() }),
});

const customerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const createdFrom = "2026-08-30T21:00:00.000Z";
const createdTo = "2026-09-06T20:59:59.999Z";
const CLOCK = { now: new Date("2026-09-02T12:00:00.000Z") } as const;

function fatSummaryRow(index: number, name: string) {
  return {
    orderId: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString().padStart(12, "0")}`,
    orderNumber: `KA-${String(1040 + index)}`,
    customer: {
      nameSnapshot: name,
      linkedCustomerId: `bbbbbbbb-bbbb-4bbb-8bbb-${index.toString().padStart(12, "0")}`,
    },
    status: (["new", "confirmed", "canceled"] as const)[index % 3],
    itemCount: (index % 7) + 1,
    totalGrossMinor: String(125_000 + index * 1_370),
    currency: "UAH",
    createdAt: new Date(Date.UTC(2026, 8, 2, 8, index, 0)).toISOString(),
    comment: "extra-handler-field",
    totalNetMinor: "1",
  };
}

function compactSummaryRow(index: number, name: string) {
  const row = fatSummaryRow(index, name);
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    customer: row.customer,
    status: row.status,
    itemCount: row.itemCount,
    totalGrossMinor: row.totalGrossMinor,
    currency: row.currency,
    createdAt: row.createdAt,
  };
}

describe("mapOrdersListPageInput", () => {
  it("maps empty façade input to page.summary with the assistant page limit", () => {
    expect(mapOrdersListPageInput({})).toEqual({
      kind: "page.summary",
      limit: ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
    });
  });

  it("maps statuses, trimmed query, and cursor onto canonical page.summary", () => {
    const parsed = ordersListPageInputSchema.parse({
      statuses: ["new", "confirmed"],
      query: "  #42  ",
      cursor: "c".repeat(LIST_ORDERS_CURSOR_MAX),
    });
    expect(mapOrdersListPageInput(parsed)).toEqual({
      kind: "page.summary",
      filter: { statuses: ["new", "confirmed"], query: "#42" },
      limit: ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
      cursor: "c".repeat(LIST_ORDERS_CURSOR_MAX),
    });
  });

  it("maps createdFrom, createdTo, and customerIds onto canonical filter", () => {
    const parsed = ordersListPageInputSchema.parse({
      statuses: ["new"],
      query: "Katya",
      createdFrom,
      createdTo,
      customerIds: [customerId],
    });
    expect(mapOrdersListPageInput(parsed)).toEqual({
      kind: "page.summary",
      filter: {
        statuses: ["new"],
        query: "Katya",
        createdFrom,
        createdTo,
        customerIds: [customerId],
      },
      limit: ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
    });
  });

  it("maps period=this_week onto Kyiv UTC bounds using the injected clock", () => {
    const parsed = ordersListPageInputSchema.parse({ period: "this_week" });
    expect(mapOrdersListPageInput(parsed, CLOCK)).toEqual({
      kind: "page.summary",
      filter: { createdFrom, createdTo },
      limit: ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
    });
  });
});

describe("mapOrdersListCountsInput", () => {
  it("defaults groupBy to status and omits filter when statuses are absent", () => {
    const parsed = ordersListCountsInputSchema.parse({});
    expect(mapOrdersListCountsInput(parsed)).toEqual({
      kind: "aggregate",
      groupBy: "status",
    });
  });

  it("maps statuses and an explicit groupBy onto canonical aggregate", () => {
    const parsed = ordersListCountsInputSchema.parse({
      statuses: ["new", "confirmed"],
      groupBy: "product",
    });
    expect(mapOrdersListCountsInput(parsed)).toEqual({
      kind: "aggregate",
      filter: { statuses: ["new", "confirmed"] },
      groupBy: "product",
    });
  });

  it("maps date and customerIds into filter without statuses", () => {
    const parsed = ordersListCountsInputSchema.parse({
      groupBy: "none",
      createdFrom,
      createdTo,
      customerIds: [customerId],
    });
    expect(mapOrdersListCountsInput(parsed)).toEqual({
      kind: "aggregate",
      filter: { createdFrom, createdTo, customerIds: [customerId] },
      groupBy: "none",
    });
  });

  it("maps trimmed query onto canonical filter.query", () => {
    const parsed = ordersListCountsInputSchema.parse({
      query: "  Катерина  ",
      groupBy: "none",
    });
    expect(mapOrdersListCountsInput(parsed)).toEqual({
      kind: "aggregate",
      filter: { query: "Катерина" },
      groupBy: "none",
    });
  });

  it("maps period=today onto Kyiv UTC bounds using the injected clock", () => {
    const parsed = ordersListCountsInputSchema.parse({
      period: "today",
      groupBy: "none",
    });
    expect(mapOrdersListCountsInput(parsed, CLOCK)).toEqual({
      kind: "aggregate",
      filter: {
        createdFrom: "2026-09-01T21:00:00.000Z",
        createdTo: "2026-09-02T20:59:59.999Z",
      },
      groupBy: "none",
    });
  });
});

describe("mapOrdersListPageOutput", () => {
  it("keeps job fields and drops extra handler keys", () => {
    const mapped = mapOrdersListPageOutput({
      kind: "page.summary",
      items: [fatSummaryRow(1, "Катерина Кексова")],
      nextCursor: "cursor-1",
      customerMatchTruncated: false,
    });
    expect(mapped).toEqual({
      kind: "page.summary",
      items: [compactSummaryRow(1, "Катерина Кексова")],
      nextCursor: "cursor-1",
      customerMatchTruncated: false,
    });
    expect(JSON.stringify(mapped)).not.toContain("extra-handler-field");
    expect(JSON.stringify(mapped)).not.toContain("totalNetMinor");
  });

  it("passes typed errors and confirmation through unchanged", () => {
    const error = {
      status: "error",
      code: "NOT_FOUND",
      message: "Order not found.",
    };
    expect(mapOrdersListPageOutput(error)).toBe(error);
    const confirmation = {
      status: STAFF_ASSISTANT_CONFIRMATION_STATUS,
      challengeId: "22222222-2222-4222-8222-222222222222",
      summary: "Confirm.",
      expiresAt: "2026-09-02T12:00:00.000Z",
      actionName: "orders.cancel",
      toolCallId: "call-1",
    };
    expect(mapOrdersListPageOutput(confirmation)).toBe(confirmation);
  });
});

describe("mapOrdersListCountsOutput", () => {
  it("keeps orderCount, money, and product quantityMilli", () => {
    const mapped = mapOrdersListCountsOutput({
      kind: "aggregate",
      orderCount: 4,
      extra: true,
      grossByCurrency: [
        { currency: "UAH", grossAmountMinor: "1500", note: "drop" },
      ],
      buckets: [
        {
          identity: {
            kind: "product",
            productId: customerId,
            variantId: null,
            extra: true,
          },
          label: "Seed",
          orderCount: 4,
          grossByCurrency: [
            { currency: "UAH", grossAmountMinor: "1500", note: "drop" },
          ],
          quantityMilli: "12000",
          unused: true,
        },
      ],
      bucketsTruncated: false,
      customerMatchTruncated: false,
    });
    expect(mapped).toEqual({
      kind: "aggregate",
      orderCount: 4,
      grossByCurrency: [{ currency: "UAH", grossAmountMinor: "1500" }],
      buckets: [
        {
          identity: {
            kind: "product",
            productId: customerId,
            variantId: null,
          },
          label: "Seed",
          orderCount: 4,
          grossByCurrency: [{ currency: "UAH", grossAmountMinor: "1500" }],
          quantityMilli: "12000",
        },
      ],
      bucketsTruncated: false,
      customerMatchTruncated: false,
    });
    expect(JSON.stringify(mapped)).not.toContain("unused");
  });

  it("slices oversized compact buckets and sets bucketsOmitted as a prefix", () => {
    const buckets = Array.from({ length: 50 }, (_, index) => ({
      identity: {
        kind: "product" as const,
        productId: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString().padStart(12, "0")}`,
        variantId: `bbbbbbbb-bbbb-4bbb-8bbb-${index.toString().padStart(12, "0")}`,
      },
      label: `Насіння соняшника каліброване преміум ${String(index)}`,
      orderCount: 50 - index,
      grossByCurrency: [
        { currency: "UAH", grossAmountMinor: String(1_500_000 + index) },
        { currency: "USD", grossAmountMinor: String(1_000 + index) },
      ],
      quantityMilli: String(12_000 + index),
    }));
    const mapped = mapOrdersListCountsOutput({
      kind: "aggregate",
      orderCount: 400,
      grossByCurrency: [
        { currency: "UAH", grossAmountMinor: "99000000" },
        { currency: "USD", grossAmountMinor: "120000" },
        { currency: "EUR", grossAmountMinor: "80000" },
      ],
      buckets,
      bucketsTruncated: true,
      customerMatchTruncated: false,
    });
    expect(isRecord(mapped)).toBe(true);
    if (!isRecord(mapped)) {
      return;
    }
    expect(mapped["orderCount"]).toBe(400);
    expect(mapped["grossByCurrency"]).toEqual([
      { currency: "UAH", grossAmountMinor: "99000000" },
      { currency: "USD", grossAmountMinor: "120000" },
      { currency: "EUR", grossAmountMinor: "80000" },
    ]);
    expect(Array.isArray(mapped["buckets"])).toBe(true);
    const kept = Array.isArray(mapped["buckets"]) ? mapped["buckets"] : [];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(50);
    expect(mapped["bucketsOmitted"]).toBe(50 - kept.length);
    expect(kept).toEqual(
      buckets.slice(0, kept.length).map((row) => ({
        identity: {
          kind: "product",
          productId: row.identity.productId,
          variantId: row.identity.variantId,
        },
        label: row.label,
        orderCount: row.orderCount,
        grossByCurrency: row.grossByCurrency,
        quantityMilli: row.quantityMilli,
      })),
    );
    expect(JSON.stringify(mapped).length).toBeLessThanOrEqual(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );
    expect(clipStaffAssistantToolResult(mapped)).toBe(mapped);
  });
});

describe("ordersListFacadeTools", () => {
  it("executes orders.list with mapped page.summary input and compact output", async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        kind: "page.summary",
        items: [fatSummaryRow(1, "Katya")],
        nextCursor: null,
        customerMatchTruncated: false,
      }),
    );
    const tools = ordersListFacadeTools(listOrders, execute);
    const result: unknown = await tools[ORDERS_LIST_PAGE_TOOL_NAME]?.execute?.(
      {
        query: "Katya",
        statuses: ["new"],
        createdFrom,
        createdTo,
        customerIds: [customerId],
      },
      { toolCallId: "call-page", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      ORDERS_LIST_ACTION_NAME,
      {
        kind: "page.summary",
        filter: {
          statuses: ["new"],
          query: "Katya",
          createdFrom,
          createdTo,
          customerIds: [customerId],
        },
        limit: ORDERS_LIST_PAGE_ASSISTANT_LIMIT,
      },
      { toolCallId: "call-page" },
    );
    expect(result).toEqual({
      kind: "page.summary",
      items: [compactSummaryRow(1, "Katya")],
      nextCursor: null,
      customerMatchTruncated: false,
    });
  });

  it("executes orders.list with mapped aggregate input including query", async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        kind: "aggregate",
        orderCount: 0,
        grossByCurrency: [],
        buckets: [],
        bucketsTruncated: false,
        customerMatchTruncated: false,
      }),
    );
    const tools = ordersListFacadeTools(listOrders, execute);
    await tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.execute?.(
      {
        groupBy: "none",
        query: "Катерина",
        createdFrom,
        createdTo,
        customerIds: [customerId],
      },
      { toolCallId: "call-counts", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      ORDERS_LIST_ACTION_NAME,
      {
        kind: "aggregate",
        filter: {
          query: "Катерина",
          createdFrom,
          createdTo,
          customerIds: [customerId],
        },
        groupBy: "none",
      },
      { toolCallId: "call-counts" },
    );
  });

  it("exposes object JSON Schema type without the Anthropic union patch", async () => {
    const tools = ordersListFacadeTools(listOrders, () => Promise.resolve({}));
    const pageJson = await asSchema(
      tools[ORDERS_LIST_PAGE_TOOL_NAME]?.inputSchema,
    ).jsonSchema;
    const countsJson = await asSchema(
      tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.inputSchema,
    ).jsonSchema;
    expect(pageJson["type"]).toBe("object");
    expect(countsJson["type"]).toBe("object");
    expect(pageJson["oneOf"]).toBeUndefined();
    expect(countsJson["oneOf"]).toBeUndefined();
  });

  it("describes period presets, Kyiv ISO, period rollups, and no server status active", () => {
    const tools = ordersListFacadeTools(listOrders, () => Promise.resolve({}));
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "quantityMilli",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "active means new plus confirmed",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "Europe/Kyiv",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "period=today",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "ISO createdFrom/createdTo remains valid",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "how many orders",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "Do not page orders_list_page and sum in the model",
    );
    expect(tools[ORDERS_LIST_PAGE_TOOL_NAME]?.description).toContain(
      "Europe/Kyiv",
    );
    expect(tools[ORDERS_LIST_PAGE_TOOL_NAME]?.description).toContain(
      "period=this_week",
    );
    expect(tools[ORDERS_LIST_PAGE_TOOL_NAME]?.description).toContain(
      "active means new plus confirmed",
    );
    expect(tools[ORDERS_LIST_PAGE_TOOL_NAME]?.description).not.toContain(
      "page.withLines",
    );
  });

  it("rejects more than three statuses and overlong query or cursor", () => {
    expect(
      ordersListPageInputSchema.safeParse({
        statuses: ["new", "confirmed", "canceled", "new"],
      }).success,
    ).toBe(false);
    expect(
      ordersListPageInputSchema.safeParse({
        query: "q".repeat(LIST_ORDERS_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      ordersListPageInputSchema.safeParse({
        cursor: "c".repeat(LIST_ORDERS_CURSOR_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      ordersListCountsInputSchema.safeParse({
        query: "q".repeat(LIST_ORDERS_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects createdFrom after createdTo and period together with ISO dates", () => {
    const inverted = {
      createdFrom: "2026-09-06T00:00:00.000Z",
      createdTo: "2026-08-30T00:00:00.000Z",
    };
    expect(ordersListPageInputSchema.safeParse(inverted).success).toBe(false);
    expect(ordersListCountsInputSchema.safeParse(inverted).success).toBe(false);
    const both = { period: "today", createdFrom };
    expect(ordersListPageInputSchema.safeParse(both).success).toBe(false);
    expect(ordersListCountsInputSchema.safeParse(both).success).toBe(false);
  });

  it("duplicates customerIds cap 50 and rejects an empty or oversized list", () => {
    expect(LIST_ORDERS_CUSTOMER_IDS_MAX).toBe(50);
    expect(ORDERS_LIST_CUSTOMER_IDS_MAX).toBe(LIST_ORDERS_CUSTOMER_IDS_MAX);
    expect(LIST_ORDERS_QUERY_MAX).toBe(100);
    expect(LIST_ORDERS_CURSOR_MAX).toBe(80);
    expect(ORDERS_LIST_PAGE_ASSISTANT_LIMIT).toBe(12);
    expect(
      ordersListPageInputSchema.safeParse({ customerIds: [] }).success,
    ).toBe(false);
    const oversized = Array.from(
      { length: LIST_ORDERS_CUSTOMER_IDS_MAX + 1 },
      (_, index) =>
        `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    );
    expect(
      ordersListPageInputSchema.safeParse({ customerIds: oversized }).success,
    ).toBe(false);
    expect(
      ordersListCountsInputSchema.safeParse({ customerIds: oversized }).success,
    ).toBe(false);
  });
});

describe("compact orders.list page clip envelope", () => {
  it("does not clip an assistant-limit compact page", () => {
    const items = Array.from(
      { length: ORDERS_LIST_PAGE_ASSISTANT_LIMIT },
      (_, index) =>
        compactSummaryRow(index, `Катерина Кексова ${String(index)}`),
    );
    const page = {
      kind: "page.summary",
      items,
      nextCursor: "n".repeat(LIST_ORDERS_CURSOR_MAX),
      customerMatchTruncated: false,
    };
    expect(JSON.stringify(page).length).toBeLessThan(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );
    expect(clipStaffAssistantToolResult(page)).toBe(page);
  });

  it("a 20-row compact fixture still exceeds the clip cap", () => {
    const items = Array.from({ length: 20 }, (_, index) =>
      compactSummaryRow(index, `Катерина Кексова ${String(index)}`),
    );
    const page = {
      kind: "page.summary",
      items,
      nextCursor: "n".repeat(LIST_ORDERS_CURSOR_MAX),
      customerMatchTruncated: false,
    };
    expect(JSON.stringify(page).length).toBeGreaterThan(
      STAFF_ASSISTANT_CLIP_JSON_MAX,
    );
    const clipped = clipStaffAssistantToolResult(page);
    expect(clipped).not.toBe(page);
    expect(
      typeof clipped === "object" &&
        clipped !== null &&
        "status" in clipped &&
        clipped.status === STAFF_ASSISTANT_CLIPPED_STATUS,
    ).toBe(true);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
