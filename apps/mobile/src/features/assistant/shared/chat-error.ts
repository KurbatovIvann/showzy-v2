/**
 * Map SSE-mount HTTP failures onto assistant copy. DefaultChatTransport
 * throws `Error` with the JSON body text — never log cookies or OTP.
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { AssistantCopy } from "../../../i18n/assistant";

export type AssistantChatErrorKind =
  | "validation"
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "unauthenticated"
  | "notConfigured";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assistantChatErrorKind(error: unknown): AssistantChatErrorKind {
  if (!(error instanceof Error)) {
    return "unavailable";
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(error.message);
  } catch {
    return "unavailable";
  }
  if (!isRecord(parsed) || typeof parsed.code !== "string") {
    return "unavailable";
  }
  switch (parsed.code) {
    case "VALIDATION":
      return "validation";
    case "UNAUTHENTICATED":
      return "unauthenticated";
    case "PERMISSION_DENIED":
      return "permission";
    case "ASSISTANT_NOT_CONFIGURED":
      return "notConfigured";
    default:
      return "unavailable";
  }
}

export function queryFailureToAssistantKind(
  kind: QueryFailureKind,
): AssistantChatErrorKind {
  switch (kind) {
    case "validation":
    case "network":
    case "offline":
    case "permission":
    case "unauthenticated":
      return kind;
    default:
      return "unavailable";
  }
}

export function assistantChatErrorMessage(
  kind: AssistantChatErrorKind,
  copy: AssistantCopy,
): string {
  return copy.errors[kind];
}
