import { describe, expect, it, vi } from "vitest";

import type { StaffAssistantChoiceCardEnvelope } from "./choice";
import {
  claimChoiceSelect,
  choiceCardState,
  executeChoiceSelect,
  pendingChoiceFromMessages,
  type AssistantChoiceMessage,
} from "./choice-presenter";

const choiceId = "33333333-3333-4333-8333-333333333333";
const lemonId = "88888888-8888-4888-8888-888888888888";
const vanillaId = "99999999-9999-4999-8999-999999999999";

const envelope = {
  status: "needs_choice" as const,
  challengeId: choiceId,
  reason: "variant_required" as const,
  productName: "Macarons",
  options: [
    { id: lemonId, label: "Lemon" },
    { id: vanillaId, label: "Vanilla" },
  ],
  optionsTruncated: false,
};

const successorId = "44444444-4444-4444-8444-444444444444";

const messages: readonly AssistantChoiceMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Create macarons" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Select a variant." },
      { type: "data-choice", data: envelope },
    ],
  },
];

function assistantChoiceMessage(
  id: string,
  data: StaffAssistantChoiceCardEnvelope,
): AssistantChoiceMessage {
  return {
    id,
    role: "assistant",
    parts: [
      { type: "text", text: "Select a variant." },
      { type: "data-choice", data },
    ],
  };
}

describe("executeChoiceSelect", () => {
  it("skips a duplicate tap and a different-option tap while a claim is in flight", async () => {
    const pending = pendingChoiceFromMessages(messages, new Set());
    expect(pending?.challengeId).toBe(choiceId);
    let resolvePost: ((value: { status: string }) => void) | undefined;
    const postChoice = vi.fn(
      () =>
        new Promise<{ status: string }>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const resolvingRef = { current: null as string | null };
    const first = executeChoiceSelect({
      pending,
      optionId: lemonId,
      resolvingRef,
      postChoice,
    });
    const duplicate = await executeChoiceSelect({
      pending,
      optionId: lemonId,
      resolvingRef,
      postChoice,
    });
    const other = await executeChoiceSelect({
      pending,
      optionId: vanillaId,
      resolvingRef,
      postChoice,
    });
    expect(duplicate).toBe("skipped");
    expect(other).toBe("skipped");
    expect(postChoice).toHaveBeenCalledOnce();
    expect(resolvingRef.current).toBe(choiceId);
    resolvePost?.({ status: "completed" });
    await expect(first).resolves.toEqual({ status: "completed" });
  });

  it("does not claim an expired card", () => {
    const resolvingRef = { current: null as string | null };
    expect(
      claimChoiceSelect({
        pending: {
          ...envelope,
          status: "expired",
          options: [],
          messageId: "a1",
        },
        optionId: lemonId,
        resolvingRef,
      }),
    ).toBeNull();
    expect(resolvingRef.current).toBeNull();
  });
});

describe("pendingChoiceFromMessages", () => {
  it("restores a live needs_choice picker", () => {
    const pending = pendingChoiceFromMessages(messages, new Set());
    expect(pending).toMatchObject({
      status: "needs_choice",
      challengeId: choiceId,
      messageId: "a1",
    });
    expect(pending?.options).toHaveLength(2);
    expect(choiceCardState({ pending, resolvingChallengeId: null })).toEqual({
      kind: "proposed",
      choice: pending,
    });
  });

  it("does not treat a completed peek as a pending tappable ChoiceCard", () => {
    const completed: StaffAssistantChoiceCardEnvelope = {
      ...envelope,
      status: "completed",
    };
    const pending = pendingChoiceFromMessages(
      [assistantChoiceMessage("a1", completed)],
      new Set(),
    );
    expect(pending).toBeNull();
    expect(
      choiceCardState({
        pending: { ...completed, messageId: "a1" },
        resolvingChallengeId: null,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("does not treat a claimed peek as a pending tappable ChoiceCard", () => {
    const claimed: StaffAssistantChoiceCardEnvelope = {
      ...envelope,
      status: "claimed",
    };
    expect(
      pendingChoiceFromMessages(
        [assistantChoiceMessage("a1", claimed)],
        new Set(),
      ),
    ).toBeNull();
    expect(
      choiceCardState({
        pending: { ...claimed, messageId: "a1" },
        resolvingChallengeId: null,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("restores expired copy, not a tappable picker", () => {
    const expired: StaffAssistantChoiceCardEnvelope = {
      status: "expired",
      challengeId: choiceId,
      options: [],
      optionsTruncated: false,
    };
    const pending = pendingChoiceFromMessages(
      [assistantChoiceMessage("a1", expired)],
      new Set(),
    );
    expect(pending).toMatchObject({
      status: "expired",
      challengeId: choiceId,
      messageId: "a1",
      options: [],
    });
    expect(
      claimChoiceSelect({
        pending,
        optionId: lemonId,
        resolvingRef: { current: null },
      }),
    ).toBeNull();
    expect(choiceCardState({ pending, resolvingChallengeId: null }).kind).toBe(
      "proposed",
    );
  });

  it("still shows a sequential later needs_choice after a completed predecessor", () => {
    const completed: StaffAssistantChoiceCardEnvelope = {
      ...envelope,
      status: "completed",
    };
    const successor: StaffAssistantChoiceCardEnvelope = {
      ...envelope,
      challengeId: successorId,
    };
    const pending = pendingChoiceFromMessages(
      [
        assistantChoiceMessage("a1", completed),
        assistantChoiceMessage("a2", successor),
      ],
      new Set(),
    );
    expect(pending).toMatchObject({
      status: "needs_choice",
      challengeId: successorId,
      messageId: "a2",
    });
  });

  it("skips an ignored live challenge so a successor picker still shows", () => {
    const successor: StaffAssistantChoiceCardEnvelope = {
      ...envelope,
      challengeId: successorId,
    };
    const pending = pendingChoiceFromMessages(
      [
        assistantChoiceMessage("a1", envelope),
        assistantChoiceMessage("a2", successor),
      ],
      new Set([choiceId]),
    );
    expect(pending).toMatchObject({
      status: "needs_choice",
      challengeId: successorId,
      messageId: "a2",
    });
  });
});
