import { describe, expect, it, vi } from "vitest";
import { CONFIRMATION_CHALLENGE_HEADER } from "@showzy/contract";

import {
  confirmationCardState,
  confirmationResumeHeaders,
  executeConfirmationConfirm,
  executeConfirmationDismiss,
  pendingConfirmationFromMessages,
  shouldMarkConfirmationResolved,
  type AssistantChatMessage,
} from "./confirmation-presenter";

const challengeA = "22222222-2222-4222-8222-222222222222";
const challengeB = "33333333-3333-4333-8333-333333333333";

const confirmationA = {
  status: "confirmation_required" as const,
  challengeId: challengeA,
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
};

const confirmationB = {
  status: "confirmation_required" as const,
  challengeId: challengeB,
  summary: "Request a signature.",
  expiresAt: "2026-09-01T12:05:00.000Z",
  actionName: "documents.requestSign",
  toolCallId: "call-sign",
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
      { type: "data-confirmation", data: confirmationA },
    ],
  },
];

const mergedResumeMessages: readonly AssistantChatMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Delete then request sign" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Confirmation required." },
      { type: "data-confirmation", data: confirmationA },
      { type: "data-confirmation", data: confirmationB },
    ],
  },
];

describe("pendingConfirmationFromMessages", () => {
  it("shows a card when confirmation is required", () => {
    expect(pendingConfirmationFromMessages(messages, new Set())).toEqual({
      ...confirmationA,
      messageId: "a1",
    });
    expect(
      confirmationCardState({
        pending: pendingConfirmationFromMessages(messages, new Set()),
        resolvingChallengeId: null,
      }),
    ).toEqual({
      kind: "proposed",
      confirmation: { ...confirmationA, messageId: "a1" },
    });
  });

  it("hides a dismissed challenge and does not execute", () => {
    const pending = pendingConfirmationFromMessages(messages, new Set());
    const dismissed = executeConfirmationDismiss({
      pending,
      dismissed: new Set(),
    });
    expect(dismissed.has(challengeA)).toBe(true);
    expect(pendingConfirmationFromMessages(messages, dismissed)).toBeNull();
    expect(
      confirmationCardState({
        pending: pendingConfirmationFromMessages(messages, dismissed),
        resolvingChallengeId: null,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("shows the later confirmation after resolved challenge A on a merged message", () => {
    const pending = pendingConfirmationFromMessages(
      mergedResumeMessages,
      new Set([challengeA]),
    );
    expect(pending).toEqual({ ...confirmationB, messageId: "a1" });
    expect(
      confirmationCardState({
        pending,
        resolvingChallengeId: null,
      }),
    ).toEqual({
      kind: "proposed",
      confirmation: { ...confirmationB, messageId: "a1" },
    });
  });
});

describe("executeConfirmationConfirm", () => {
  it("calls challenge resume with the confirmation header", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const pending = pendingConfirmationFromMessages(messages, new Set());
    await expect(
      executeConfirmationConfirm({
        pending,
        dismissedChallengeIds: new Set(),
        resume,
      }),
    ).resolves.toBe("resumed");
    expect(resume).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledWith({
      [CONFIRMATION_CHALLENGE_HEADER]: challengeA,
    });
    expect(confirmationResumeHeaders(challengeA)).toEqual({
      [CONFIRMATION_CHALLENGE_HEADER]: challengeA,
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
        dismissedChallengeIds: dismissed,
        resume,
      }),
    ).resolves.toBe("skipped");
    expect(resume).not.toHaveBeenCalled();
  });

  it("does not resume when dismiss then confirm share the live dismissed set", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const pending = pendingConfirmationFromMessages(messages, new Set());
    const gate = {
      dismissed: new Set<string>(),
    };
    gate.dismissed = new Set(
      executeConfirmationDismiss({
        pending,
        dismissed: gate.dismissed,
      }),
    );
    await expect(
      executeConfirmationConfirm({
        pending,
        dismissedChallengeIds: gate.dismissed,
        resume,
      }),
    ).resolves.toBe("skipped");
    expect(resume).not.toHaveBeenCalled();
  });

  it("resumes later challenge B with its header after A is resolved", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const pending = pendingConfirmationFromMessages(
      mergedResumeMessages,
      new Set([challengeA]),
    );
    await expect(
      executeConfirmationConfirm({
        pending,
        dismissedChallengeIds: new Set([challengeA]),
        resume,
      }),
    ).resolves.toBe("resumed");
    expect(resume).toHaveBeenCalledWith({
      [CONFIRMATION_CHALLENGE_HEADER]: challengeB,
    });
  });
});

describe("shouldMarkConfirmationResolved", () => {
  const pendingA = {
    ...confirmationA,
    messageId: "a1",
  };

  it("keeps the card when a failed resume still completes ready with the same challenge", () => {
    const failedResume: readonly AssistantChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "data-confirmation", data: confirmationA },
          {
            type: "tool-customers.deleteCustomer",
            toolCallId: "call-delete",
            state: "output-available",
            output: { status: "error", code: "INTERNAL" },
          },
        ],
      },
    ];
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: pendingConfirmationFromMessages(failedResume, new Set()),
        hasError: false,
        messages: failedResume,
      }),
    ).toBe(false);
    expect(pendingConfirmationFromMessages(failedResume, new Set())).toEqual(
      pendingA,
    );
  });

  it("keeps the card when the stream reports a tool output-error", () => {
    const failedResume: readonly AssistantChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "data-confirmation", data: confirmationA },
          {
            type: "tool-customers.deleteCustomer",
            toolCallId: "call-delete",
            state: "output-error",
          },
        ],
      },
    ];
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: pendingA,
        hasError: false,
        messages: failedResume,
      }),
    ).toBe(false);
  });

  it("does not mark resolved when ready with no consume signal", () => {
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: pendingA,
        hasError: false,
        messages,
      }),
    ).toBe(false);
  });

  it("marks resolved when the matching tool result succeeded", () => {
    const succeeded: readonly AssistantChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "data-confirmation", data: confirmationA },
          {
            type: "tool-customers.deleteCustomer",
            toolCallId: "call-delete",
            state: "output-available",
            output: { id: "44444444-4444-4444-8444-444444444444" },
          },
        ],
      },
    ];
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: pendingA,
        hasError: false,
        messages: succeeded,
      }),
    ).toBe(true);
  });

  it("marks resolved when a later confirmation replaced the challenge", () => {
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: { ...confirmationB, messageId: "a1" },
        hasError: false,
        messages: mergedResumeMessages,
      }),
    ).toBe(true);
  });

  it("does not mark resolved when the chat reports an error", () => {
    expect(
      shouldMarkConfirmationResolved({
        resolvingChallengeId: challengeA,
        pending: null,
        hasError: true,
        messages,
      }),
    ).toBe(false);
  });
});
