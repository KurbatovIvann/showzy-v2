/**
 * Authenticated choice resume and safe peek (SHO-418 / T8a HTTP).
 * Cookie + `x-company-id` are headers — never action input. Body is
 * `{ conversationId, choiceId, optionId }` only.
 */
import { fetch as expoFetch } from "expo/fetch";
import { z } from "zod";

import {
  envelopeFromChoicePeek,
  type StaffAssistantChoiceCardEnvelope,
} from "../shared/choice";
import type { ChoiceSelectResult } from "../shared/choice-presenter";
import { staffAssistantChatHeaders } from "./assistant-chat-headers";

export const ASSISTANT_CHOICE_PATH = "/assistant/choice";

const choiceSelectResultSchema = z.object({
  status: z.string().min(1),
  text: z.string().optional(),
  challengeId: z.uuid().optional(),
  reason: z.string().optional(),
  productName: z.string().optional(),
  options: z
    .array(z.object({ id: z.uuid(), label: z.string().min(1) }))
    .optional(),
  optionsTruncated: z.boolean().optional(),
  entity: z
    .object({ orderId: z.uuid(), orderNumber: z.string().min(1) })
    .optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

function assistantOrigin(apiOrigin: string): string {
  return apiOrigin.replace(/\/+$/, "");
}

export function assistantChoiceUrl(apiOrigin: string): string {
  return `${assistantOrigin(apiOrigin)}${ASSISTANT_CHOICE_PATH}`;
}

export function assistantChoicePeekUrl(
  apiOrigin: string,
  choiceId: string,
  conversationId: string,
): string {
  const base = assistantChoiceUrl(apiOrigin);
  return `${base}/${choiceId}?conversationId=${encodeURIComponent(conversationId)}`;
}

export async function postAssistantChoice(args: {
  readonly apiUrl: string;
  readonly getCookie: () => string | null;
  readonly getCompanyId: () => string | null;
  readonly conversationId: string;
  readonly choiceId: string;
  readonly optionId: string;
}): Promise<ChoiceSelectResult> {
  const response = await expoFetch(assistantChoiceUrl(args.apiUrl), {
    method: "POST",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      ...staffAssistantChatHeaders({
        cookie: args.getCookie(),
        companyId: args.getCompanyId(),
      }),
    },
    body: JSON.stringify({
      conversationId: args.conversationId,
      choiceId: args.choiceId,
      optionId: args.optionId,
    }),
  });
  const raw: unknown = await response.json();
  const parsed = choiceSelectResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", text: "Choice resume failed." };
  }
  return parsed.data;
}

export async function peekAssistantChoice(args: {
  readonly apiUrl: string;
  readonly getCookie: () => string | null;
  readonly getCompanyId: () => string | null;
  readonly conversationId: string;
  readonly choiceId: string;
}): Promise<StaffAssistantChoiceCardEnvelope> {
  const response = await expoFetch(
    assistantChoicePeekUrl(args.apiUrl, args.choiceId, args.conversationId),
    {
      method: "GET",
      credentials: "omit",
      headers: staffAssistantChatHeaders({
        cookie: args.getCookie(),
        companyId: args.getCompanyId(),
      }),
    },
  );
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    raw = { status: "expired" };
  }
  return envelopeFromChoicePeek(args.choiceId, raw);
}
