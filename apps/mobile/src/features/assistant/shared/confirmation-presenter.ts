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
  readonly toolCallId?: string;
  readonly state?: string;
  readonly output?: unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolErrorOutput(output: unknown): boolean {
  return isRecord(output) && output.status === "error";
}

/**
 * Latest unignored `data-confirmation`. Ignored (dismissed/resolved) ids
 * are skipped so a later HITL card on a merged assistant message still
 * shows (AI SDK 7 resume merge + core.md §7).
 */
export function pendingConfirmationFromMessages(
  messages: readonly AssistantChatMessage[],
  dismissedChallengeIds: ReadonlySet<string>,
): PendingConfirmation | null {
  let latest: PendingConfirmation | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      const confirmation = confirmationFromChatPart(part);
      if (confirmation === undefined) {
        continue;
      }
      if (dismissedChallengeIds.has(confirmation.challengeId)) {
        continue;
      }
      latest = { ...confirmation, messageId: message.id };
    }
  }
  return latest;
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
 * A failed HTTP 200 resume keeps the same `data-confirmation` part. Only
 * treat the challenge as consumed when the tool output is no longer that
 * confirmation and is not a tool error.
 */
export function confirmationResumeOutcome(args: {
  readonly challengeId: string;
  readonly toolCallId: string;
  readonly messages: readonly AssistantChatMessage[];
}): "open" | "succeeded" | "failed" {
  for (const message of args.messages) {
    for (const part of message.parts) {
      if (part.toolCallId !== args.toolCallId) {
        continue;
      }
      if (part.state === "output-error") {
        return "failed";
      }
      if (part.output === undefined) {
        continue;
      }
      const paused = confirmationFromChatPart(part.output);
      if (paused?.challengeId === args.challengeId) {
        continue;
      }
      if (isToolErrorOutput(part.output)) {
        return "failed";
      }
      return "succeeded";
    }
  }
  return "open";
}

/**
 * Mark resolved only when the resume consumed the challenge: the id is
 * gone from pending parts and there is no error, a newer confirmation
 * replaced it, or the matching tool result succeeded.
 */
export function shouldMarkConfirmationResolved(args: {
  readonly resolvingChallengeId: string;
  readonly pending: PendingConfirmation | null;
  readonly hasError: boolean;
  readonly messages: readonly AssistantChatMessage[];
}): boolean {
  if (args.hasError) {
    return false;
  }
  if (args.pending === null) {
    return true;
  }
  if (args.pending.challengeId !== args.resolvingChallengeId) {
    return true;
  }
  return (
    confirmationResumeOutcome({
      challengeId: args.resolvingChallengeId,
      toolCallId: args.pending.toolCallId,
      messages: args.messages,
    }) === "succeeded"
  );
}

/**
 * Claim the in-flight HITL resolve synchronously so two confirm() calls
 * before `sendBusy` cannot both POST. Same pattern as dismiss: a live ref.
 */
export function claimConfirmationConfirm(args: {
  readonly pending: PendingConfirmation | null;
  readonly sendBusy: boolean;
  readonly dismissedChallengeIds: ReadonlySet<string>;
  readonly resolvingRef: { current: string | null };
}): PendingConfirmation | null {
  if (args.pending === null || args.sendBusy) {
    return null;
  }
  if (args.dismissedChallengeIds.has(args.pending.challengeId)) {
    return null;
  }
  if (args.resolvingRef.current !== null) {
    return null;
  }
  args.resolvingRef.current = args.pending.challengeId;
  return args.pending;
}

/**
 * AI-mount equivalent of `submitWithProtocolConfirmation`: the challenge
 * already streamed as `data-confirmation`. Confirm POSTs the same
 * messages plus the challenge header. Never skip HITL. Same-tick dismiss
 * is visible when `dismissedChallengeIds` is the live set (a ref).
 * `resolvingRef` is claimed synchronously before the resume await.
 */
export async function executeConfirmationConfirm(args: {
  readonly pending: PendingConfirmation | null;
  readonly sendBusy: boolean;
  readonly dismissedChallengeIds: ReadonlySet<string>;
  readonly resolvingRef: { current: string | null };
  readonly resume: (headers: Readonly<Record<string, string>>) => Promise<void>;
}): Promise<"resumed" | "skipped"> {
  const claimed = claimConfirmationConfirm({
    pending: args.pending,
    sendBusy: args.sendBusy,
    dismissedChallengeIds: args.dismissedChallengeIds,
    resolvingRef: args.resolvingRef,
  });
  if (claimed === null) {
    return "skipped";
  }
  await args.resume(confirmationResumeHeaders(claimed.challengeId));
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
