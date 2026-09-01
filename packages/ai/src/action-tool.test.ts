import { defineActionContract } from "@showzy/core/contract";
import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  actionContractToTool,
  fromProviderToolName,
  PROVIDER_TOOL_NAME_PATTERN,
  staffAssistantTools,
  toProviderToolName,
} from "./action-tool.js";

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
  input: z.object({}).default({}),
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

describe("staffAssistantTools", () => {
  it("keys the ToolSet with provider-safe names and dispatches to orders.list", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const execute = vi.fn(() => Promise.resolve({ items: [] }));
    const tools = staffAssistantTools([listOrders, deleteCustomer], execute);
    const names = Object.keys(tools);
    expect(names).toEqual(["orders_list", "customers_deleteCustomer"]);
    for (const name of names) {
      expect(name).toMatch(PROVIDER_TOOL_NAME_PATTERN);
      expect(name).not.toContain(".");
    }
    await tools["orders_list"]?.execute?.(
      {},
      { toolCallId: "call-1", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      "orders.list",
      {},
      { toolCallId: "call-1" },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
