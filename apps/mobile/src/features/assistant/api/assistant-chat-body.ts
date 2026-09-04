/**
 * Serialize useChat UI messages into the SSE mount body (SHO-322).
 * Strict `{ conversationId, messages, locale }` — never `companyId`.
 */
import { detectLocale, type Locale } from "../../../i18n/locale";
import { choiceEnvelopeForWire } from "../shared/choice";

export const ASSISTANT_CHAT_PATH = "/assistant/chat";
export const STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX = 16_000;
/** Match `@showzy/ai` request cap. Hydrated history can already be 50. */
export const STAFF_ASSISTANT_CHAT_MESSAGES_MAX = 50;

export function assistantChatUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/+$/, "")}${ASSISTANT_CHAT_PATH}`;
}

export type StaffChatUiPart = {
  readonly type: string;
  readonly text?: string;
  readonly data?: unknown;
};

export type StaffChatUiMessage = {
  readonly id: string;
  readonly role: string;
  readonly parts?: readonly StaffChatUiPart[];
};

export type StaffChatWirePart = {
  readonly type: string;
  readonly text?: string;
  readonly data?: unknown;
};

export type StaffChatWireMessage = {
  readonly id: string;
  readonly role: "system" | "user" | "assistant";
  readonly parts: readonly StaffChatWirePart[];
};

export type StaffAssistantChatBody = {
  readonly conversationId: string;
  readonly messages: readonly StaffChatWireMessage[];
  readonly locale: Locale;
};

export class AssistantConversationMissingError extends Error {
  constructor() {
    super("conversation required");
    this.name = "AssistantConversationMissingError";
  }
}

function isChatRole(role: string): role is "system" | "user" | "assistant" {
  return role === "system" || role === "user" || role === "assistant";
}

function wireParts(parts: readonly StaffChatUiPart[]): StaffChatWirePart[] {
  const wired: StaffChatWirePart[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      wired.push({
        type: "text",
        text: part.text.slice(0, STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX),
      });
      continue;
    }
    if (part.type === "data-confirmation") {
      wired.push({ type: "data-confirmation", data: part.data });
      continue;
    }
    if (part.type === "data-choice") {
      const envelope = choiceEnvelopeForWire(part.data ?? part);
      if (envelope !== undefined) {
        wired.push({ type: "data-choice", data: envelope });
      }
    }
  }
  return wired;
}

export function staffChatWireMessages(
  messages: readonly StaffChatUiMessage[],
): StaffChatWireMessage[] {
  const wired: StaffChatWireMessage[] = [];
  for (const message of messages) {
    if (!isChatRole(message.role) || message.id.length === 0) {
      continue;
    }
    wired.push({
      id: message.id,
      role: message.role,
      parts: wireParts(message.parts ?? []),
    });
  }
  return wired.length > STAFF_ASSISTANT_CHAT_MESSAGES_MAX
    ? wired.slice(-STAFF_ASSISTANT_CHAT_MESSAGES_MAX)
    : wired;
}

export function prepareStaffAssistantChatRequest(args: {
  readonly conversationId: string | null;
  readonly messages: readonly StaffChatUiMessage[];
  readonly locale?: Locale;
}): { readonly body: StaffAssistantChatBody } {
  if (args.conversationId === null) {
    throw new AssistantConversationMissingError();
  }
  return {
    body: {
      conversationId: args.conversationId,
      messages: staffChatWireMessages(args.messages),
      locale: args.locale ?? detectLocale(),
    },
  };
}

/**
 * Keep `headers` (cookie, `x-company-id`, optional challenge) so a later
 * `prepareSendMessagesRequest` cannot drop `x-confirmation-challenge-id`.
 */
export function prepareStaffAssistantSendMessagesRequest(args: {
  readonly conversationId: string | null;
  readonly messages: readonly StaffChatUiMessage[];
  readonly headers: HeadersInit | undefined;
}): {
  readonly body: StaffAssistantChatBody;
  readonly credentials: "omit";
  readonly headers?: HeadersInit;
} {
  const prepared = prepareStaffAssistantChatRequest({
    conversationId: args.conversationId,
    messages: args.messages,
  });
  if (args.headers === undefined) {
    return {
      body: prepared.body,
      credentials: "omit",
    };
  }
  return {
    body: prepared.body,
    credentials: "omit",
    headers: args.headers,
  };
}

export function clipAssistantInput(text: string): string {
  return text.trim().slice(0, STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX);
}
