import { defineActionContract } from "@showzy/core/contract";
import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  mapOrdersListCountsInput,
  mapOrdersListPageInput,
  ORDERS_LIST_ACTION_NAME,
  ORDERS_LIST_COUNTS_TOOL_NAME,
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

describe("mapOrdersListPageInput", () => {
  it("maps empty façade input to page.summary without filter or cursor", () => {
    expect(mapOrdersListPageInput({})).toEqual({ kind: "page.summary" });
  });

  it("maps statuses, trimmed query, and cursor onto canonical page.summary", () => {
    const parsed = ordersListPageInputSchema.parse({
      statuses: ["new", "confirmed"],
      query: "  #42  ",
      cursor: "c".repeat(80),
    });
    expect(mapOrdersListPageInput(parsed)).toEqual({
      kind: "page.summary",
      filter: { statuses: ["new", "confirmed"], query: "#42" },
      cursor: "c".repeat(80),
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
});

describe("ordersListFacadeTools", () => {
  it("executes orders.list with mapped page.summary input and toolCallId", async () => {
    const execute = vi.fn(() => Promise.resolve({ kind: "page.summary" }));
    const tools = ordersListFacadeTools(listOrders, execute);
    await tools[ORDERS_LIST_PAGE_TOOL_NAME]?.execute?.(
      { query: "Katya", statuses: ["new"] },
      { toolCallId: "call-page", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      ORDERS_LIST_ACTION_NAME,
      {
        kind: "page.summary",
        filter: { statuses: ["new"], query: "Katya" },
      },
      { toolCallId: "call-page" },
    );
  });

  it("executes orders.list with mapped aggregate input and toolCallId", async () => {
    const execute = vi.fn(() => Promise.resolve({ kind: "aggregate" }));
    const tools = ordersListFacadeTools(listOrders, execute);
    await tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.execute?.(
      { groupBy: "none", statuses: ["confirmed"] },
      { toolCallId: "call-counts", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      ORDERS_LIST_ACTION_NAME,
      {
        kind: "aggregate",
        filter: { statuses: ["confirmed"] },
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

  it("describes no server status active and product quantityMilli", () => {
    const tools = ordersListFacadeTools(listOrders, () => Promise.resolve({}));
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
      "quantityMilli",
    );
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.description).toContain(
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
      ordersListPageInputSchema.safeParse({ query: "q".repeat(101) }).success,
    ).toBe(false);
    expect(
      ordersListPageInputSchema.safeParse({ cursor: "c".repeat(81) }).success,
    ).toBe(false);
  });
});
