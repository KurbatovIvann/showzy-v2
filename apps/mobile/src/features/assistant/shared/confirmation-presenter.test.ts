import { describe, expect, it, vi } from "vitest";
import { CONFIRMATION_CHALLENGE_HEADER } from "@showzy/contract";

import {
  confirmationCardState,
  confirmationResumeHeaders,
  executeConfirmationConfirm,
  executeConfirmationDismiss,
  pendingConfirmationFromMessages,
  type AssistantChatMessage,
} from "./confirmation-presenter";

const challengeId = "22222222-2222-4222-8222-222222222222";

const confirmation = {
  status: "confirmation_required" as const,
  challengeId,
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
};

const messages: readonly AssistantChatMessage[] = [
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
      { type: "data-confirmation", data: confirmation },
    ],
  },
];

describe("pendingConfirmationFromMessages", () => {
  it("shows a card when confirmation is required", () => {
    expect(pendingConfirmationFromMessages(messages, new Set())).toEqual({
      ...confirmation,
      messageId: "a1",
    });
    expect(
      confirmationCardState({
        pending: pendingConfirmationFromMessages(messages, new Set()),
        resolvingChallengeId: null,
      }),
    ).toEqual({
      kind: "proposed",
      confirmation: { ...confirmation, messageId: "a1" },
    });
  });

  it("hides a dismissed challenge and does not execute", () => {
    const pending = pendingConfirmationFromMessages(messages, new Set());
    const dismissed = executeConfirmationDismiss({
      pending,
      dismissed: new Set(),
    });
    expect(dismissed.has(challengeId)).toBe(true);
    expect(pendingConfirmationFromMessages(messages, dismissed)).toBeNull();
    expect(
      confirmationCardState({
        pending: pendingConfirmationFromMessages(messages, dismissed),
        resolvingChallengeId: null,
      }),
    ).toEqual({ kind: "hidden" });
  });
});

describe("executeConfirmationConfirm", () => {
  it("calls challenge resume with the confirmation header", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const pending = pendingConfirmationFromMessages(messages, new Set());
    await expect(executeConfirmationConfirm({ pending, resume })).resolves.toBe(
      "resumed",
    );
    expect(resume).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledWith({
      [CONFIRMATION_CHALLENGE_HEADER]: challengeId,
    });
    expect(confirmationResumeHeaders(challengeId)).toEqual({
      [CONFIRMATION_CHALLENGE_HEADER]: challengeId,
    });
  });

  it("does not resume when dismiss runs instead", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const pending = pendingConfirmationFromMessages(messages, new Set());
    const dismissed = executeConfirmationDismiss({
      pending,
      dismissed: new Set(),
    });
    await expect(
      executeConfirmationConfirm({
        pending: pendingConfirmationFromMessages(messages, dismissed),
        resume,
      }),
    ).resolves.toBe("skipped");
    expect(resume).not.toHaveBeenCalled();
  });
});
