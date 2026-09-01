import { describe, expect, it } from "vitest";

import { confirmationFromChatPart } from "./confirmation";

const challengeId = "22222222-2222-4222-8222-222222222222";

const confirmation = {
  status: "confirmation_required" as const,
  challengeId,
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
};

describe("confirmationFromChatPart", () => {
  it("reads a matching data-confirmation envelope", () => {
    expect(
      confirmationFromChatPart({
        type: "data-confirmation",
        data: confirmation,
      }),
    ).toEqual(confirmation);
  });

  it("reads a flattened confirmation object", () => {
    expect(confirmationFromChatPart(confirmation)).toEqual(confirmation);
  });

  it("returns undefined for unrelated parts", () => {
    expect(
      confirmationFromChatPart({ type: "text", text: "Hello" }),
    ).toBeUndefined();
  });
});
