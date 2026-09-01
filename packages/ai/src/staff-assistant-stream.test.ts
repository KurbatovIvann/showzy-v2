import { ConfirmationRequiredError } from "@showzy/core/errors";
import { defineActionContract } from "@showzy/core/contract";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { staffAssistantTools, toProviderToolName } from "./action-tool.js";
import {
  isStaffAssistantConfirmationOutput,
  STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT,
} from "./confirmation.js";
import {
  extractUuidResultIds,
  streamStaffAssistantChat,
} from "./staff-assistant-stream.js";
import {
  MockLanguageModelV3,
  mockTextStream,
  mockToolCallStream,
  readUiMessageSsePayloads,
} from "./test.js";

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

const customerId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";

describe("extractUuidResultIds", () => {
  it("collects top-level uuid ids and ignores nested list rows", () => {
    const orderId = "33333333-3333-4333-8333-333333333333";
    expect(extractUuidResultIds({ orderId, status: "new" })).toEqual([orderId]);
    expect(
      extractUuidResultIds({
        items: [{ orderId }],
        nextCursor: null,
      }),
    ).toEqual([]);
  });
});

describe("staffAssistantTools", () => {
  it("keys tools by provider-safe name and never calls fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const execute = vi.fn(() => Promise.resolve({ items: [] }));
    const tools = staffAssistantTools([listOrders], execute);
    expect(Object.keys(tools)).toEqual(["orders_list"]);
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

describe("streamStaffAssistantChat", () => {
  it("runs a read tool and streams UI-message SSE without touching the network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const execute = vi.fn(() =>
      Promise.resolve({ items: [], nextCursor: null }),
    );
    const model = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream(
          "call-list",
          toProviderToolName("orders.list"),
          "{}",
        ),
        mockTextStream("You have no orders."),
      ],
    });

    const { response, completion } = streamStaffAssistantChat({
      model,
      messages: [{ role: "user", content: "List orders" }],
      contracts: [listOrders],
      execute,
    });

    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const payloads = await readUiMessageSsePayloads(response);
    const turn = await completion;

    expect(execute).toHaveBeenCalledWith(
      "orders.list",
      {},
      { toolCallId: "call-list" },
    );
    expect(turn.toolRuns).toEqual([
      {
        actionName: "orders.list",
        toolCallId: "call-list",
        resultIds: [],
        outcome: "success",
      },
    ]);
    expect(turn.text).toContain("You have no orders.");
    expect(JSON.stringify(payloads)).toContain("You have no orders.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("pauses on ConfirmationRequiredError and streams a redacted confirmation part", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const summary =
      "Delete this archived customer. Confirm the name and primary contact.";
    const execute = vi.fn(() =>
      Promise.reject(
        new ConfirmationRequiredError({
          challengeId,
          summary,
          expiresAt: "2026-09-01T12:00:00.000Z",
        }),
      ),
    );
    const model = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream(
          "call-delete",
          toProviderToolName("customers.deleteCustomer"),
          JSON.stringify({ id: customerId }),
        ),
        mockTextStream("should not auto-confirm"),
      ],
    });

    const { response, completion } = streamStaffAssistantChat({
      model,
      messages: [{ role: "user", content: "Delete the customer" }],
      contracts: [deleteCustomer],
      execute,
    });

    const payloads = await readUiMessageSsePayloads(response);
    const turn = await completion;

    expect(execute).toHaveBeenCalledTimes(1);
    expect(turn.toolRuns).toEqual([
      {
        actionName: "customers.deleteCustomer",
        toolCallId: "call-delete",
        challengeId,
        resultIds: [],
        outcome: "confirmation_required",
      },
    ]);
    expect(turn.text).toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
    expect(JSON.stringify(payloads)).not.toContain("should not auto-confirm");

    const confirmationChunks = payloads.filter((payload) => {
      return (
        typeof payload === "object" &&
        payload !== null &&
        "type" in payload &&
        payload.type === "data-confirmation"
      );
    });
    expect(confirmationChunks.length).toBeGreaterThanOrEqual(1);
    const first = confirmationChunks[0];
    expect(first).toMatchObject({
      type: "data-confirmation",
      data: {
        status: "confirmation_required",
        challengeId,
        summary,
        actionName: "customers.deleteCustomer",
        toolCallId: "call-delete",
      },
    });
    expect(
      isStaffAssistantConfirmationOutput(
        first !== undefined &&
          typeof first === "object" &&
          first !== null &&
          "data" in first
          ? first.data
          : undefined,
      ),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("awaits onTurn after text and fails the stream when persist fails", async () => {
    const onTurn = vi.fn(() => Promise.reject(new Error("persist failed")));
    const model = new MockLanguageModelV3({
      doStream: [mockTextStream("You have no orders.")],
    });
    const { response, completion } = streamStaffAssistantChat({
      model,
      messages: [{ role: "user", content: "List orders" }],
      contracts: [listOrders],
      execute: () => Promise.resolve({ items: [], nextCursor: null }),
      onTurn,
    });
    const payloads = await readUiMessageSsePayloads(response);
    const turn = await completion;
    expect(turn.text).toContain("You have no orders.");
    expect(onTurn).toHaveBeenCalledOnce();
    expect(onTurn).toHaveBeenCalledWith(turn);
    expect(JSON.stringify(payloads)).toContain(
      "The assistant could not complete this turn.",
    );
  });
});
