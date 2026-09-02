import { defineActionContract } from "@showzy/core/contract";
import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  actionContractToTool,
  CATALOG_LIST_PRODUCTS_TOOL_NAME,
  ensureAnthropicToolInputSchemaType,
  fromProviderToolName,
  ORDERS_LIST_COUNTS_TOOL_NAME,
  ORDERS_LIST_PAGE_TOOL_NAME,
  PRICING_LIST_PRICE_LISTS_TOOL_NAME,
  PROVIDER_TOOL_NAME_PATTERN,
  staffAssistantHotToolNames,
  staffAssistantTools,
  STAFF_ASSISTANT_TOOL_SEARCH_NAME,
  toProviderToolName,
} from "./action-tool.js";
import {
  STAFF_ASSISTANT_CACHE_CONTROL,
  STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
} from "./anthropic-options.js";

const customerId = "11111111-1111-4111-8111-111111111111";

const listOrders = defineActionContract({
  name: "orders.list",
  description: "List orders in the active company.",
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
  timeout: 5_000,
  input: z.looseObject({}),
  output: z.object({
    items: z.array(z.object({ orderId: z.uuid() })),
    nextCursor: z.string().nullable(),
  }),
});

const deleteCustomer = defineActionContract({
  name: "customers.deleteCustomer",
  description: "Hard-delete an archived CRM customer. Requires confirmation.",
  principal: "staff",
  transport: "client",
  aiExposure: "exposed",
  permissions: ["customers:delete"],
  risk: "high",
  requiresConfirmation: true,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
  input: z.object({ id: z.uuid() }),
  output: z.object({ id: z.uuid() }),
});

describe("toProviderToolName", () => {
  it("maps dotted action names onto Anthropic-safe keys and round-trips", () => {
    expect(toProviderToolName("orders.list")).toBe("orders_list");
    expect(toProviderToolName("customers.deleteCustomer")).toBe(
      "customers_deleteCustomer",
    );
    expect(toProviderToolName("orders.list")).toMatch(
      PROVIDER_TOOL_NAME_PATTERN,
    );
    expect(fromProviderToolName("orders_list")).toBe("orders.list");
    expect(fromProviderToolName("customers_deleteCustomer")).toBe(
      "customers.deleteCustomer",
    );
    expect(
      fromProviderToolName(toProviderToolName("customers.deleteCustomer")),
    ).toBe("customers.deleteCustomer");
  });
});

describe("actionContractToTool", () => {
  it("passes the action name and validated input to the injected execute callback", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const execute = vi.fn((actionName: string, input: unknown) =>
      Promise.resolve({ actionName, input }),
    );

    const aiTool = actionContractToTool(deleteCustomer, execute);
    expect(aiTool.description).toBe(deleteCustomer.description);
    expect(aiTool.execute).toBeTypeOf("function");

    await aiTool.execute?.(
      { id: customerId },
      {
        toolCallId: "tool-1",
        messages: [],
        context: undefined,
      },
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      "customers.deleteCustomer",
      { id: customerId },
      { toolCallId: "tool-1" },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("patches Anthropic input_schema.type on remaining 1:1 union tools", async () => {
    const unionList = defineActionContract({
      name: "documents.listDocuments",
      description: "List documents.",
      principal: "staff",
      transport: "client",
      aiExposure: "exposed",
      permissions: ["documents:view"],
      risk: "read",
      requiresConfirmation: false,
      idempotent: false,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: false,
      timeout: 5_000,
      input: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("page") }),
        z.strictObject({ kind: z.literal("aggregate") }),
      ]),
      output: z.object({ ok: z.boolean() }),
    });
    const raw = { ...z.toJSONSchema(unionList.input) };
    expect(raw["type"]).toBeUndefined();
    const aiTool = actionContractToTool(unionList, () =>
      Promise.resolve({ ok: true }),
    );
    const json = await asSchema(aiTool.inputSchema).jsonSchema;
    expect(json["type"]).toBe("object");
    expect(json["oneOf"]).toBeDefined();
  });

  it("exposes the contract input schema as the AI SDK tool schema", async () => {
    const execute = vi.fn(() => Promise.resolve({ ok: true }));
    const aiTool = actionContractToTool(deleteCustomer, execute);
    const schema = asSchema(aiTool.inputSchema);

    const rejected = await schema.validate?.({ id: "not-a-uuid" });
    expect(rejected?.success).toBe(false);

    const accepted = await schema.validate?.({ id: customerId });
    expect(accepted).toEqual({
      success: true,
      value: { id: customerId },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not invoke execute when input fails the contract schema", async () => {
    const execute = vi.fn(() => Promise.resolve({ ok: true }));
    const aiTool = actionContractToTool(deleteCustomer, execute);

    await expect(
      aiTool.execute?.(
        { id: "not-a-uuid" },
        { toolCallId: "tool-2", messages: [], context: undefined },
      ),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("ensureAnthropicToolInputSchemaType", () => {
  it("adds type object to Zod 4 union schemas that omit type", () => {
    const union = z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("page.summary") }),
      z.strictObject({ kind: z.literal("aggregate") }),
    ]);
    const raw = { ...z.toJSONSchema(union) };
    expect(raw["type"]).toBeUndefined();
    expect(raw["oneOf"]).toBeDefined();
    expect(ensureAnthropicToolInputSchemaType(raw)["type"]).toBe("object");
  });

  it("leaves object schemas that already have type unchanged", () => {
    const objectSchema = z.strictObject({ query: z.string().optional() });
    const raw = { ...z.toJSONSchema(objectSchema) };
    expect(raw["type"]).toBe("object");
    expect(ensureAnthropicToolInputSchemaType(raw)).toEqual(raw);
  });
});

describe("staffAssistantTools", () => {
  it("advertises named orders.list façades and still dispatches to orders.list", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const execute = vi.fn(() => Promise.resolve({ items: [] }));
    const tools = staffAssistantTools([listOrders, deleteCustomer], execute);
    const names = Object.keys(tools);
    expect(names).toEqual([
      STAFF_ASSISTANT_TOOL_SEARCH_NAME,
      ORDERS_LIST_PAGE_TOOL_NAME,
      ORDERS_LIST_COUNTS_TOOL_NAME,
      "customers_deleteCustomer",
    ]);
    expect(names).not.toContain("orders_list");
    expect(names).not.toContain(toProviderToolName("orders.list"));
    for (const name of names) {
      expect(name).toMatch(PROVIDER_TOOL_NAME_PATTERN);
      expect(name).not.toContain(".");
    }
    await tools[ORDERS_LIST_PAGE_TOOL_NAME]?.execute?.(
      {},
      { toolCallId: "call-1", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      "orders.list",
      { kind: "page.summary" },
      { toolCallId: "call-1" },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps hot façades and search in context and defers the rest", () => {
    const tools = staffAssistantTools([listOrders, deleteCustomer], () =>
      Promise.resolve({ items: [] }),
    );
    expect(tools[STAFF_ASSISTANT_TOOL_SEARCH_NAME]).toBeDefined();
    expect(tools[ORDERS_LIST_COUNTS_TOOL_NAME]?.providerOptions).toEqual({
      anthropic: { cacheControl: STAFF_ASSISTANT_CACHE_CONTROL },
    });
    expect(tools[ORDERS_LIST_PAGE_TOOL_NAME]?.providerOptions).toBeUndefined();
    expect(tools["customers_deleteCustomer"]?.providerOptions).toEqual(
      STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
    );
  });

  it("lists advertised hot tool names rather than the 1:1 union keys", () => {
    expect(staffAssistantHotToolNames()).toEqual([
      ORDERS_LIST_PAGE_TOOL_NAME,
      ORDERS_LIST_COUNTS_TOOL_NAME,
      "orders_get",
      CATALOG_LIST_PRODUCTS_TOOL_NAME,
      PRICING_LIST_PRICE_LISTS_TOOL_NAME,
      "customers_listCustomers",
    ]);
    expect(staffAssistantHotToolNames()).not.toContain("orders_list");
    expect(staffAssistantHotToolNames()).not.toContain("catalog_listProducts");
    expect(staffAssistantHotToolNames()).not.toContain(
      "pricing_listPriceLists",
    );
  });

  it("caches search when every domain tool is deferred", () => {
    const tools = staffAssistantTools([deleteCustomer], () =>
      Promise.resolve({}),
    );
    expect(tools[STAFF_ASSISTANT_TOOL_SEARCH_NAME]?.providerOptions).toEqual({
      anthropic: { cacheControl: STAFF_ASSISTANT_CACHE_CONTROL },
    });
    expect(tools["customers_deleteCustomer"]?.providerOptions).toEqual(
      STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
    );
  });

  it("attaches nothing when the contract list is empty", () => {
    const tools = staffAssistantTools([], () => Promise.resolve({}));
    expect(tools).toEqual({});
  });

  it("advertises catalog_list_products and still dispatches to catalog.listProducts", async () => {
    const listProducts = defineActionContract({
      name: "catalog.listProducts",
      description: "List products in the active company.",
      principal: "staff",
      transport: "client",
      aiExposure: "exposed",
      permissions: ["products:view"],
      risk: "read",
      requiresConfirmation: false,
      idempotent: false,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: false,
      timeout: 5_000,
      input: z.looseObject({}),
      output: z.object({
        items: z.array(z.object({ id: z.uuid() })),
        nextCursor: z.string().nullable(),
      }),
    });
    const execute = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: customerId,
            name: "Seed",
            basePriceMinor: "1000",
            currency: "UAH",
            status: "active",
            variantCount: 0,
            primaryImageFileId: null,
            createdAt: "2026-09-01T12:00:00.000Z",
            updatedAt: "2026-09-01T12:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    );
    const tools = staffAssistantTools([listProducts], execute);
    const names = Object.keys(tools);
    expect(names).toContain(CATALOG_LIST_PRODUCTS_TOOL_NAME);
    expect(names).not.toContain("catalog_listProducts");
    expect(names).not.toContain(toProviderToolName("catalog.listProducts"));
    const executeTool = tools[CATALOG_LIST_PRODUCTS_TOOL_NAME]?.execute;
    expect(executeTool).toBeTypeOf("function");
    if (executeTool === undefined) {
      return;
    }
    const result: unknown = await executeTool(
      {},
      { toolCallId: "call-catalog", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      "catalog.listProducts",
      { status: "active", limit: 20 },
      { toolCallId: "call-catalog" },
    );
    expect(result).toEqual({
      items: [
        {
          id: customerId,
          name: "Seed",
          basePriceMinor: "1000",
          currency: "UAH",
          status: "active",
          variantCount: 0,
        },
      ],
      nextCursor: null,
    });
  });

  it("advertises pricing_list_price_lists and still dispatches to pricing.listPriceLists", async () => {
    const listPriceLists = defineActionContract({
      name: "pricing.listPriceLists",
      description: "List price lists in the active company.",
      principal: "staff",
      transport: "client",
      aiExposure: "exposed",
      permissions: ["pricing:view"],
      risk: "read",
      requiresConfirmation: false,
      idempotent: false,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: false,
      timeout: 5_000,
      input: z.object({
        query: z.string().trim().min(1).max(100).optional(),
        availability: z.enum(["all", "active", "inactive"]).default("all"),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().min(1).max(200).optional(),
      }),
      output: z.object({
        items: z.array(z.object({ id: z.uuid() })),
        nextCursor: z.string().nullable(),
      }),
    });
    const execute = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: customerId,
            name: "Opt",
            isDefault: false,
            isActive: true,
            entryCount: 0,
          },
        ],
        nextCursor: null,
      }),
    );
    const tools = staffAssistantTools([listPriceLists], execute);
    const names = Object.keys(tools);
    expect(names).toContain(PRICING_LIST_PRICE_LISTS_TOOL_NAME);
    expect(names).not.toContain("pricing_listPriceLists");
    expect(names).not.toContain(toProviderToolName("pricing.listPriceLists"));
    const executeTool = tools[PRICING_LIST_PRICE_LISTS_TOOL_NAME]?.execute;
    expect(executeTool).toBeTypeOf("function");
    if (executeTool === undefined) {
      return;
    }
    const result: unknown = await executeTool(
      { query: "Opt" },
      { toolCallId: "call-pricing", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      "pricing.listPriceLists",
      { query: "Opt", availability: "all", limit: 20 },
      { toolCallId: "call-pricing" },
    );
    expect(result).toEqual({
      items: [
        {
          id: customerId,
          name: "Opt",
          isDefault: false,
          isActive: true,
          entryCount: 0,
        },
      ],
      nextCursor: null,
    });
  });

  it("keeps pricing writes deferred and does not flatten their schemas", async () => {
    const createPriceList = defineActionContract({
      name: "pricing.createPriceList",
      description: "Create a price list in the staff member's active company.",
      principal: "staff",
      transport: "client",
      aiExposure: "exposed",
      permissions: ["pricing:manage"],
      risk: "write",
      requiresConfirmation: false,
      idempotent: true,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: true,
      timeout: 5_000,
      input: z.strictObject({
        name: z.string().min(1),
        isDefault: z.boolean().default(false),
        isActive: z.boolean().default(true),
      }),
      output: z.object({ id: z.uuid() }),
    });
    const setPriceListEntries = defineActionContract({
      name: "pricing.setPriceListEntries",
      description: "Upsert prices on a price list.",
      principal: "staff",
      transport: "client",
      aiExposure: "exposed",
      permissions: ["pricing:manage"],
      risk: "write",
      requiresConfirmation: false,
      idempotent: true,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: true,
      timeout: 10_000,
      input: z.strictObject({
        priceListId: z.uuid(),
        entries: z.array(z.strictObject({ productId: z.uuid() })).min(1),
      }),
      output: z.object({ items: z.array(z.object({ id: z.uuid() })) }),
    });
    const tools = staffAssistantTools(
      [createPriceList, setPriceListEntries],
      () => Promise.resolve({}),
    );
    const createName = toProviderToolName("pricing.createPriceList");
    const setName = toProviderToolName("pricing.setPriceListEntries");
    expect(Object.keys(tools)).toContain(createName);
    expect(Object.keys(tools)).toContain(setName);
    expect(tools[createName]?.providerOptions).toEqual(
      STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
    );
    expect(tools[setName]?.providerOptions).toEqual(
      STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
    );
    expect(tools[createName]?.description).toContain(
      "pricing_list_price_lists",
    );
    expect(tools[createName]?.description).toContain(
      "pricing.setPriceListEntries",
    );
    expect(tools[setName]?.description).toContain("catalog_list_products");
    const setJson = await asSchema(tools[setName]?.inputSchema).jsonSchema;
    expect(setJson["type"]).toBe("object");
    expect(setJson["oneOf"]).toBeUndefined();
  });
});
