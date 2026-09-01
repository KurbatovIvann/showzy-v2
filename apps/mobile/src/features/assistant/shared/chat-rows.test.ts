import { describe, expect, it } from "vitest";

import { assistantChatRows } from "./chat-rows";
import type { PendingConfirmation } from "./confirmation-presenter";

const pending: PendingConfirmation = {
  status: "confirmation_required",
  challengeId: "22222222-2222-4222-8222-222222222222",
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
  messageId: "a1",
};

describe("assistantChatRows", () => {
  it("attaches the pending confirmation to the matching assistant row", () => {
    expect(
      assistantChatRows(
        [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Delete the customer" }],
          },
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "text", text: "Confirmation required." }],
          },
        ],
        pending,
      ),
    ).toEqual([
      {
        id: "u1",
        role: "user",
        text: "Delete the customer",
        confirmation: null,
      },
      {
        id: "a1",
        role: "assistant",
        text: "Confirmation required.",
        confirmation: pending,
      },
    ]);
  });
});
