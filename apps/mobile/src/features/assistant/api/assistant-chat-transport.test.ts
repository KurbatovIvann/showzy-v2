import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
} from "@showzy/contract";

const fetchMock = vi.fn();

vi.mock("expo/fetch", () => ({
  fetch: (...args: unknown[]) => fetchMock(...args) as Promise<Response>,
}));

import { createStaffAssistantTransport } from "./assistant-chat-transport";

const conversationId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";

function headerValue(
  headers: HeadersInit | undefined,
  name: string,
): string | null {
  if (headers === undefined) {
    return null;
  }
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const found = headers.find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    );
    return found?.[1] ?? null;
  }
  const record = headers;
  const direct = record[name];
  if (typeof direct === "string") {
    return direct;
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower && typeof value === "string") {
      return value;
    }
  }
  return null;
}

describe("createStaffAssistantTransport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    });
  });

  it("sends x-confirmation-challenge-id on confirm resume", async () => {
    const transport = createStaffAssistantTransport({
      apiUrl: "https://api.example.com",
      getCookie: () => "better-auth.session_token=abc",
      getCompanyId: () => "company-a",
      getConversationId: () => conversationId,
    });
    await transport
      .sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        abortSignal: undefined,
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Delete the customer" }],
          },
        ],
        headers: { [CONFIRMATION_CHALLENGE_HEADER]: challengeId },
      })
      .catch(() => undefined);
    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(headerValue(init?.headers, CONFIRMATION_CHALLENGE_HEADER)).toBe(
      challengeId,
    );
    expect(headerValue(init?.headers, COMPANY_SELECTOR_HEADER)).toBe(
      "company-a",
    );
    expect(headerValue(init?.headers, "cookie")).toBe(
      "better-auth.session_token=abc",
    );
    expect(JSON.stringify(init?.body ?? "")).not.toContain("companyId");
  });
});
