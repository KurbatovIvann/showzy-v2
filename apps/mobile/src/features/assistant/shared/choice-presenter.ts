/**
 * HITL ChoiceCard presenter (SHO-418). Tap POSTs `{ conversationId,
 * choiceId, optionId }` only — no canonical input, target, or mapping.
 * Resume does not call the LLM.
 */
import { assistantCopy } from "../../../i18n/assistant";
import {
  isCurrentAssistantChoiceSelect,
  type AssistantCompanyEpochRef,
} from "./assistant-session";
import {
  claimedRetryOptionId,
  choiceFromChatPart,
  envelopeFromChoicePeek,
  isRestorableChoiceStatus,
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

export type ChoiceSelectRecoverability = "retryable" | "terminal" | "ambiguous";

export type ChoiceSelectResult = {
  readonly status: string;
  readonly text?: string | undefined;
  readonly challengeId?: string | undefined;
  readonly reason?: string | undefined;
  readonly choiceKind?: "variant" | "product" | "customer" | undefined;
  readonly productName?: string | undefined;
  readonly options?:
    readonly { readonly id: string; readonly label: string }[] | undefined;
  readonly optionsTruncated?: boolean | undefined;
  readonly entity?:
    { readonly orderId: string; readonly orderNumber: string } | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
  readonly httpStatus?: number | undefined;
  readonly retryAfterSec?: number | undefined;
  readonly recoverability?: ChoiceSelectRecoverability | undefined;
};

const TERMINAL_INTERACTION_CODES = new Set([
  "CHOICE_OPTION_CONFLICT",
  "CHOICE_INVALID_OPTION",
]);

const TERMINAL_WIRE_CODES = new Set([
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "VALIDATION",
  "IDEMPOTENCY_CONFLICT",
]);

const RETRYABLE_WIRE_CODES = new Set([
  "RETRY_IN_PROGRESS",
  "RATE_LIMITED",
  "INTERNAL",
  "TIMEOUT",
]);

function httpStatusRecoverability(
  httpStatus: number,
): ChoiceSelectRecoverability | undefined {
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    httpStatus === 400 ||
    httpStatus === 404 ||
    httpStatus === 422
  ) {
    return "terminal";
  }
  if (
    httpStatus === 408 ||
    httpStatus === 429 ||
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 504 ||
    (httpStatus >= 500 && httpStatus <= 599)
  ) {
    return "retryable";
  }
  if (httpStatus === 409) {
    return undefined;
  }
  return undefined;
}

/**
 * Classify a choice POST outcome from real server codes and HTTP status.
 * 409 is retryable only for `RETRY_IN_PROGRESS`, not every conflict.
 */
export function deriveChoiceSelectRecoverability(
  result: ChoiceSelectResult,
): ChoiceSelectRecoverability {
  if (result.status === "completed" || result.status === "expired") {
    return "terminal";
  }
  if (result.status === "needs_choice") {
    return needsChoiceEnvelopeFromSelectResult(result) !== undefined
      ? "terminal"
      : "ambiguous";
  }
  if (typeof result.code === "string") {
    if (
      TERMINAL_INTERACTION_CODES.has(result.code) ||
      TERMINAL_WIRE_CODES.has(result.code)
    ) {
      return "terminal";
    }
    if (RETRYABLE_WIRE_CODES.has(result.code)) {
      return "retryable";
    }
  }
  if (typeof result.httpStatus === "number") {
    const fromHttp = httpStatusRecoverability(result.httpStatus);
    if (fromHttp !== undefined) {
      return fromHttp;
    }
  }
  return "ambiguous";
}

export function classifyChoiceSelect(
  result: ChoiceSelectResult,
): ChoiceSelectRecoverability {
  return result.recoverability ?? deriveChoiceSelectRecoverability(result);
}

export function choiceSelectAllowsSameOptionRetry(
  result: ChoiceSelectResult,
): boolean {
  const recoverability = classifyChoiceSelect(result);
  return recoverability === "retryable" || recoverability === "ambiguous";
}

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

function choiceEnvelopeIsRestorable(
  status: StaffAssistantChoiceCardEnvelope["status"],
): boolean {
  return isRestorableChoiceStatus(status);
}

/**
 * Latest open picker (`needs_choice`), claimed recovery, or expired copy.
 * Completed peeks are not a ChoiceCard — the later successful entity turn
 * hydrates on its own. Ignored ids skip tappable `needs_choice` / `claimed`
 * so a sequential successor still shows. Expired copy for a consumed
 * challenge stays visible (hydrate `{ status: "expired" }` peek, and POST
 * `{ status: "expired" }`). Temporary peek failures are omitted, not
 * expired.
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
      if (!choiceEnvelopeIsRestorable(choice.status)) {
        continue;
      }
      if (
        (choice.status === "needs_choice" || choice.status === "claimed") &&
        ignoredChallengeIds.has(choice.challengeId)
      ) {
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
  if (
    args.pending === null ||
    !choiceEnvelopeIsRestorable(args.pending.status)
  ) {
    return { kind: "hidden" };
  }
  if (args.resolvingChallengeId === args.pending.challengeId) {
    return { kind: "applying", choice: args.pending };
  }
  return { kind: "proposed", choice: args.pending };
}

function choiceSelectOptionAllowed(
  pending: PendingChoice,
  optionId: string,
): boolean {
  if (pending.status === "needs_choice") {
    return pending.options.some((option) => option.id === optionId);
  }
  if (pending.status === "claimed") {
    return claimedRetryOptionId(pending) === optionId;
  }
  return false;
}

/**
 * Claim the in-flight option synchronously so duplicate and different-
 * option taps skip before POST. `resolvingRef` is the live lock.
 * Claimed recovery may retry only the already-claimed opaque option.
 */
export function claimChoiceSelect(args: {
  readonly pending: PendingChoice | null;
  readonly optionId: string;
  readonly resolvingRef: { current: string | null };
}): PendingChoice | null {
  if (args.pending === null) {
    return null;
  }
  if (!choiceSelectOptionAllowed(args.pending, args.optionId)) {
    return null;
  }
  if (args.resolvingRef.current !== null) {
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

function needsChoiceEnvelopeFromSelectResult(
  result: ChoiceSelectResult,
): StaffAssistantChoiceCardEnvelope | undefined {
  if (result.status !== "needs_choice") {
    return undefined;
  }
  if (typeof result.optionsTruncated !== "boolean") {
    return undefined;
  }
  if (result.options === undefined) {
    return undefined;
  }
  const parsed = staffAssistantChoiceCardEnvelopeSchema.safeParse({
    status: "needs_choice",
    challengeId: result.challengeId,
    ...(typeof result.reason === "string" ? { reason: result.reason } : {}),
    ...(result.choiceKind === "variant" ||
    result.choiceKind === "product" ||
    result.choiceKind === "customer"
      ? { choiceKind: result.choiceKind }
      : {}),
    ...(typeof result.productName === "string"
      ? { productName: result.productName }
      : {}),
    options: result.options,
    optionsTruncated: result.optionsTruncated,
  });
  return parsed.success ? parsed.data : undefined;
}

export function choiceSelectShouldIgnoreChallenge(
  result: ChoiceSelectResult,
): boolean {
  return classifyChoiceSelect(result) === "terminal";
}

/**
 * Visible copy after a terminal `{ status: "error" }` POST body. Prefer
 * `text`, then distinct auth/permission copy from the real wire code,
 * then the HTTP `message` (`CHOICE_OPTION_CONFLICT` /
 * `CHOICE_INVALID_OPTION`), then existing assistant unavailable copy.
 * Never sendMessage. Never surface confirmation challenge tokens.
 */
export function presentChoiceSelectErrorText(
  result: ChoiceSelectResult,
  locale: "uk" | "en",
): string {
  if (typeof result.text === "string" && result.text.length > 0) {
    return result.text;
  }
  const copy = assistantCopy(locale);
  if (result.code === "UNAUTHENTICATED" || result.httpStatus === 401) {
    return copy.errors.unauthenticated;
  }
  if (result.code === "PERMISSION_DENIED" || result.httpStatus === 403) {
    return copy.errors.permission;
  }
  if (typeof result.message === "string" && result.message.length > 0) {
    return result.message;
  }
  return copy.errors.unavailable;
}

/**
 * Local append after POST /assistant/choice. Never sendMessage — resume
 * must not call the LLM. Sequential `needs_choice` speech is the server
 * `text` (SHO-427); do not invent a second bubble from the envelope.
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
    const envelope = needsChoiceEnvelopeFromSelectResult(args.result);
    if (envelope === undefined) {
      return [];
    }
    if (typeof args.result.text !== "string" || args.result.text.length === 0) {
      return [];
    }
    return [
      { type: "text", text: args.result.text },
      { type: "data-choice", data: envelope },
    ];
  }
  if (args.result.status === "expired") {
    const expired = envelopeFromChoicePeek(
      args.previousChoiceId,
      args.result,
    ) ?? {
      status: "expired" as const,
      challengeId: args.previousChoiceId,
      options: [],
      optionsTruncated: false,
    };
    return [
      {
        type: "data-choice",
        data: expired,
      },
    ];
  }
  if (
    args.result.status === "error" &&
    classifyChoiceSelect(args.result) === "terminal"
  ) {
    return [
      {
        type: "text",
        text: presentChoiceSelectErrorText(args.result, args.locale),
      },
    ];
  }
  return [];
}

export type CommitChoiceSelectResult = "skipped" | "stale" | "applied";

/**
 * Apply a POST /assistant/choice body onto the current tenant session.
 * Append first so an expired envelope is in `messages` before ignore
 * skips the tappable `needs_choice`. Retryable and ambiguous outcomes
 * keep the original challenge so the same option can be posted again.
 * Drop ignore + append when the company epoch moved or `reset()` cleared
 * the resolving lock.
 */
export function commitChoiceSelectResult(args: {
  readonly result: ChoiceSelectResult | "skipped";
  readonly previousChoiceId: string;
  readonly locale: "uk" | "en";
  readonly companyEpochRef: AssistantCompanyEpochRef;
  readonly epoch: number;
  readonly resolvingRef: { readonly current: string | null };
  readonly appendParts: (parts: readonly ChoiceAppendPart[]) => void;
  readonly ignoreChallenge: (challengeId: string) => void;
}): CommitChoiceSelectResult {
  if (args.result === "skipped") {
    return "skipped";
  }
  if (
    !isCurrentAssistantChoiceSelect({
      companyEpochRef: args.companyEpochRef,
      epoch: args.epoch,
      resolvingRef: args.resolvingRef,
      challengeId: args.previousChoiceId,
    })
  ) {
    return "stale";
  }
  const parts = choiceSelectAppendParts({
    result: args.result,
    previousChoiceId: args.previousChoiceId,
    locale: args.locale,
  });
  if (parts.length > 0) {
    args.appendParts(parts);
  }
  if (choiceSelectShouldIgnoreChallenge(args.result)) {
    args.ignoreChallenge(args.previousChoiceId);
  }
  return "applied";
}
