import { describe, expect, it, vi } from "vitest";

import {
  claimChoiceSelect,
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
