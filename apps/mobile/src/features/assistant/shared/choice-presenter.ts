/**
 * HITL ChoiceCard presenter (SHO-418). Tap POSTs `{ conversationId,
 * choiceId, optionId }` only — no canonical input, target, or mapping.
 * Resume does not call the LLM.
 */
import {
  choiceFromChatPart,
  envelopeFromChoicePeek,
  presentChoiceCardText,
  staffAssistantChoiceCardEnvelopeSchema,
  type StaffAssistantChoiceCardEnvelope,
} from "./choice";

export type AssistantChoicePart = {
  readonly type: string;
  readonly text?: string;
  readonly data?: unknown;
  readonly toolCallId?: string;
  readonly toolName?: string;
  readonly state?: string;
  readonly input?: unknown;
  readonly output?: unknown;
};

export type AssistantChoiceMessage = {
  readonly id: string;
  readonly role: string;
  readonly parts: readonly AssistantChoicePart[];
};

export type PendingChoice = StaffAssistantChoiceCardEnvelope & {
  readonly messageId: string;
};

export type ChoiceCardState =
  | { readonly kind: "hidden" }
  | {
      readonly kind: "proposed";
      readonly choice: PendingChoice;
    }
  | {
      readonly kind: "applying";
      readonly choice: PendingChoice;
    };

export type ChoiceSelectResult = {
  readonly status: string;
  readonly text?: string | undefined;
  readonly challengeId?: string | undefined;
  readonly reason?: string | undefined;
  readonly productName?: string | undefined;
  readonly options?:
    readonly { readonly id: string; readonly label: string }[] | undefined;
  readonly optionsTruncated?: boolean | undefined;
  readonly entity?:
    { readonly orderId: string; readonly orderNumber: string } | undefined;
};

export type ChoiceAppendPart =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "data-choice";
      readonly data: StaffAssistantChoiceCardEnvelope;
    }
  | {
      readonly type: "dynamic-tool";
      readonly toolName: "orders.create";
      readonly toolCallId: string;
      readonly state: "output-available";
      readonly input: Record<string, never>;
      readonly output: {
        readonly orderId: string;
        readonly orderNumber: string;
      };
    };

/**
 * Latest unignored `data-choice`. Ignored (resolved/expired-consumed) ids
 * are skipped so a sequential successor card on a later message still
 * shows.
 */
export function pendingChoiceFromMessages(
  messages: readonly AssistantChoiceMessage[],
  ignoredChallengeIds: ReadonlySet<string>,
): PendingChoice | null {
  let latest: PendingChoice | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      const choice = choiceFromChatPart(part);
      if (choice === undefined) {
        continue;
      }
      if (ignoredChallengeIds.has(choice.challengeId)) {
        continue;
      }
      latest = { ...choice, messageId: message.id };
    }
  }
  return latest;
}

export function choiceCardState(args: {
  readonly pending: PendingChoice | null;
  readonly resolvingChallengeId: string | null;
}): ChoiceCardState {
  if (args.pending === null) {
    return { kind: "hidden" };
  }
  if (args.resolvingChallengeId === args.pending.challengeId) {
    return { kind: "applying", choice: args.pending };
  }
  return { kind: "proposed", choice: args.pending };
}

/**
 * Claim the in-flight option synchronously so duplicate and different-
 * option taps skip before POST. `resolvingRef` is the live lock.
 */
export function claimChoiceSelect(args: {
  readonly pending: PendingChoice | null;
  readonly optionId: string;
  readonly resolvingRef: { current: string | null };
}): PendingChoice | null {
  if (args.pending === null) {
    return null;
  }
  if (args.pending.status !== "needs_choice") {
    return null;
  }
  if (args.resolvingRef.current !== null) {
    return null;
  }
  const allowed = args.pending.options.some(
    (option) => option.id === args.optionId,
  );
  if (!allowed) {
    return null;
  }
  args.resolvingRef.current = args.pending.challengeId;
  return args.pending;
}

export async function executeChoiceSelect(args: {
  readonly pending: PendingChoice | null;
  readonly optionId: string;
  readonly resolvingRef: { current: string | null };
  readonly postChoice: (input: {
    readonly choiceId: string;
    readonly optionId: string;
  }) => Promise<ChoiceSelectResult>;
}): Promise<ChoiceSelectResult | "skipped"> {
  const claimed = claimChoiceSelect({
    pending: args.pending,
    optionId: args.optionId,
    resolvingRef: args.resolvingRef,
  });
  if (claimed === null) {
    return "skipped";
  }
  return args.postChoice({
    choiceId: claimed.challengeId,
    optionId: args.optionId,
  });
}

export function choiceSelectShouldIgnoreChallenge(
  result: ChoiceSelectResult,
): boolean {
  return (
    result.status === "completed" ||
    result.status === "needs_choice" ||
    result.status === "expired"
  );
}

/**
 * Local append after POST /assistant/choice. Never sendMessage — resume
 * must not call the LLM.
 */
export function choiceSelectAppendParts(args: {
  readonly result: ChoiceSelectResult;
  readonly previousChoiceId: string;
  readonly locale: "uk" | "en";
}): readonly ChoiceAppendPart[] {
  if (args.result.status === "completed") {
    const parts: ChoiceAppendPart[] = [];
    if (typeof args.result.text === "string" && args.result.text.length > 0) {
      parts.push({ type: "text", text: args.result.text });
    }
    if (args.result.entity !== undefined) {
      parts.push({
        type: "dynamic-tool",
        toolName: "orders.create",
        toolCallId: `choice:${args.previousChoiceId}`,
        state: "output-available",
        input: {},
        output: {
          orderId: args.result.entity.orderId,
          orderNumber: args.result.entity.orderNumber,
        },
      });
    }
    return parts;
  }
  if (args.result.status === "needs_choice") {
    const parsed = staffAssistantChoiceCardEnvelopeSchema.safeParse({
      status: "needs_choice",
      challengeId: args.result.challengeId,
      ...(typeof args.result.reason === "string"
        ? { reason: args.result.reason }
        : {}),
      ...(typeof args.result.productName === "string"
        ? { productName: args.result.productName }
        : {}),
      options: args.result.options ?? [],
      optionsTruncated: args.result.optionsTruncated ?? false,
    });
    if (!parsed.success) {
      return [];
    }
    return [
      {
        type: "text",
        text: presentChoiceCardText(parsed.data, args.locale),
      },
      { type: "data-choice", data: parsed.data },
    ];
  }
  if (args.result.status === "expired") {
    return [
      {
        type: "data-choice",
        data: envelopeFromChoicePeek(args.previousChoiceId, args.result),
      },
    ];
  }
  return [];
}
