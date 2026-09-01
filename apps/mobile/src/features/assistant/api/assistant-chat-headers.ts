/**
 * Session cookie + company selector + optional HITL challenge for
 * `POST /assistant/chat`. Never logs cookie or OTP values.
 */
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
} from "@showzy/contract";

export function staffAssistantChatHeaders(args: {
  readonly cookie: string | null;
  readonly companyId: string | null;
  readonly confirmationChallengeId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (args.cookie !== null && args.cookie !== "") {
    headers.cookie = args.cookie;
  }
  if (args.companyId !== null && args.companyId !== "") {
    headers[COMPANY_SELECTOR_HEADER] = args.companyId;
  }
  if (
    args.confirmationChallengeId !== undefined &&
    args.confirmationChallengeId !== ""
  ) {
    headers[CONFIRMATION_CHALLENGE_HEADER] = args.confirmationChallengeId;
  }
  return headers;
}
