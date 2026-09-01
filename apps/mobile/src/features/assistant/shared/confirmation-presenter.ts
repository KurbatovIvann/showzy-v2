/**
 * HITL card presenter for the staff assistant (SHO-323). Confirm resumes
 * the SSE mount with `x-confirmation-challenge-id` and echoed
 * `data-confirmation` parts. Dismiss is local — it must not execute.
 */
import { CONFIRMATION_CHALLENGE_HEADER } from "@showzy/contract";

import {
  confirmationFromChatPart,
  type StaffAssistantConfirmation,
} from "./confirmation";

export type AssistantChatPart = {
  readonly type: string;
  readonly text?: string;
  readonly data?: unknown;
};

export type AssistantChatMessage = {
  readonly id: string;
  readonly role: string;
  readonly parts: readonly AssistantChatPart[];
};

export type PendingConfirmation = StaffAssistantConfirmation & {
  readonly messageId: string;
};

export type ConfirmationCardState =
  | { readonly kind: "hidden" }
  | {
      readonly kind: "proposed";
      readonly confirmation: PendingConfirmation;
    }
  | {
      readonly kind: "applying";
      readonly confirmation: PendingConfirmation;
    };

export function pendingConfirmationFromMessages(
  messages: readonly AssistantChatMessage[],
  dismissedChallengeIds: ReadonlySet<string>,
): PendingConfirmation | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message === undefined || message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      const confirmation = confirmationFromChatPart(part);
      if (confirmation === undefined) {
        continue;
      }
      if (dismissedChallengeIds.has(confirmation.challengeId)) {
        return null;
      }
      return { ...confirmation, messageId: message.id };
    }
  }
  return null;
}

export function confirmationCardState(args: {
  readonly pending: PendingConfirmation | null;
  readonly resolvingChallengeId: string | null;
}): ConfirmationCardState {
  if (args.pending === null) {
    return { kind: "hidden" };
  }
  if (args.resolvingChallengeId === args.pending.challengeId) {
    return { kind: "applying", confirmation: args.pending };
  }
  return { kind: "proposed", confirmation: args.pending };
}

export function confirmationResumeHeaders(
  challengeId: string,
): Readonly<Record<string, string>> {
  return { [CONFIRMATION_CHALLENGE_HEADER]: challengeId };
}

/**
 * AI-mount equivalent of `submitWithProtocolConfirmation`: the challenge
 * already streamed as `data-confirmation`. Confirm POSTs the same
 * messages plus the challenge header. Never skip HITL.
 */
export async function executeConfirmationConfirm(args: {
  readonly pending: PendingConfirmation | null;
  readonly resume: (headers: Readonly<Record<string, string>>) => Promise<void>;
}): Promise<"resumed" | "skipped"> {
  if (args.pending === null) {
    return "skipped";
  }
  await args.resume(confirmationResumeHeaders(args.pending.challengeId));
  return "resumed";
}

export function executeConfirmationDismiss(args: {
  readonly pending: PendingConfirmation | null;
  readonly dismissed: ReadonlySet<string>;
}): ReadonlySet<string> {
  if (args.pending === null) {
    return args.dismissed;
  }
  const next = new Set(args.dismissed);
  next.add(args.pending.challengeId);
  return next;
}
