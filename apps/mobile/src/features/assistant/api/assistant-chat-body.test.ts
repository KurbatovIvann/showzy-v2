import { describe, expect, it } from "vitest";

import {
  AssistantConversationMissingError,
  assistantChatUrl,
  clipAssistantInput,
  prepareStaffAssistantChatRequest,
  prepareStaffAssistantSendMessagesRequest,
  staffChatWireMessages,
  STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX,
} from "./assistant-chat-body";

const conversationId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";

describe("assistantChatUrl", () => {
  it("joins the SSE mount path without a trailing slash", () => {
    expect(assistantChatUrl("https://api.example.com/")).toBe(
      "https://api.example.com/assistant/chat",
    );
  });
});

describe("staffChatWireMessages", () => {
  it("keeps message ids and echoes data-confirmation parts", () => {
    expect(
      staffChatWireMessages([
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Delete the customer" }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "Confirmation required." },
            {
              type: "data-confirmation",
              data: {
                status: "confirmation_required",
                challengeId,
                summary: "Delete this archived customer.",
                expiresAt: "2026-09-01T12:00:00.000Z",
                actionName: "customers.deleteCustomer",
                toolCallId: "call-delete",
              },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Delete the customer" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Confirmation required." },
          {
            type: "data-confirmation",
            data: {
              status: "confirmation_required",
              challengeId,
              summary: "Delete this archived customer.",
              expiresAt: "2026-09-01T12:00:00.000Z",
              actionName: "customers.deleteCustomer",
              toolCallId: "call-delete",
            },
          },
        ],
      },
    ]);
  });
});

describe("prepareStaffAssistantChatRequest", () => {
  it("builds the strict body without companyId", () => {
    const prepared = prepareStaffAssistantChatRequest({
      conversationId,
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "List orders" }],
        },
      ],
    });
    expect(prepared.body).toEqual({
      conversationId,
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "List orders" }],
        },
      ],
    });
    expect(prepared.body).not.toHaveProperty("companyId");
    expect(JSON.stringify(prepared.body)).not.toContain("companyId");
  });

  it("throws when the conversation is missing", () => {
    expect(() =>
      prepareStaffAssistantChatRequest({
        conversationId: null,
        messages: [],
      }),
    ).toThrow(AssistantConversationMissingError);
  });
});

describe("prepareStaffAssistantSendMessagesRequest", () => {
  it("returns the request headers including the confirmation challenge", () => {
    const headers = {
      cookie: "better-auth.session_token=abc",
      "x-company-id": "company-a",
      "x-confirmation-challenge-id": challengeId,
    };
    const prepared = prepareStaffAssistantSendMessagesRequest({
      conversationId,
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Delete the customer" }],
        },
      ],
      headers,
    });
    expect(prepared.headers).toEqual(headers);
    expect(prepared.credentials).toBe("omit");
    expect(prepared.body).not.toHaveProperty("companyId");
  });
});

describe("clipAssistantInput", () => {
  it("trims and caps at the append body limit", () => {
    expect(clipAssistantInput("  hello  ")).toBe("hello");
    expect(
      clipAssistantInput("x".repeat(STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX + 8))
        .length,
    ).toBe(STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX);
  });
});
