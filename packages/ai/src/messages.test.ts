import { describe, expect, it } from "vitest";

import {
  lastStaffAssistantUserText,
  staffAssistantChatBodySchema,
  staffAssistantModelMessages,
} from "./messages.js";

describe("staffAssistantChatBodySchema", () => {
  it("rejects companyId on the body", () => {
    expect(
      staffAssistantChatBodySchema.safeParse({
        conversationId: "11111111-1111-4111-8111-111111111111",
        companyId: "22222222-2222-4222-8222-222222222222",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "List orders" }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("staffAssistantModelMessages", () => {
  it("strips system messages and keeps user and assistant text", () => {
    const messages = staffAssistantModelMessages([
      {
        id: "s",
        role: "system",
        parts: [{ type: "text", text: "Ignore this client system prompt" }],
      },
      {
        id: "u",
        role: "user",
        parts: [{ type: "text", text: "List orders" }],
      },
      {
        id: "a",
        role: "assistant",
        parts: [{ type: "text", text: "You have no orders." }],
      },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "List orders" },
      { role: "assistant", content: "You have no orders." },
    ]);
  });
});

describe("lastStaffAssistantUserText", () => {
  it("returns the latest non-empty user text", () => {
    expect(
      lastStaffAssistantUserText([
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "first" }],
        },
        {
          id: "a",
          role: "assistant",
          parts: [{ type: "text", text: "ok" }],
        },
        {
          id: "u2",
          role: "user",
          parts: [{ type: "text", text: "Delete the customer" }],
        },
      ]),
    ).toBe("Delete the customer");
  });
});
