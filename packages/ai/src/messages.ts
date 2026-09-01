import type { ModelMessage } from "ai";
import { z } from "zod";

import { confirmationFromChatPart } from "./confirmation.js";

/**
 * Match `assistant` `messageBodySchema` (16_000). Request validation so
 * append and the model payload cannot diverge — not a core.md §10
 * conversation-budget hook.
 */
export const STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX = 16_000;
export const STAFF_ASSISTANT_CHAT_MESSAGES_MAX = 50;
export const STAFF_ASSISTANT_CHAT_PARTS_MAX = 32;

const chatPartSchema = z.looseObject({
  type: z.string().min(1).max(64),
  text: z.string().max(STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX).optional(),
});

function textFromParts(
  parts: readonly { type: string; text?: string },
): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export const staffAssistantChatMessageSchema = z
  .object({
    id: z.string().min(1).max(128),
    role: z.enum(["system", "user", "assistant"]),
    parts: z
      .array(chatPartSchema)
      .max(STAFF_ASSISTANT_CHAT_PARTS_MAX)
      .default([]),
  })
  .superRefine((message, ctx) => {
    if (
      textFromParts(message.parts).length >
      STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["parts"],
        message: `Message text must be at most ${STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX} characters.`,
      });
    }
  });

export const staffAssistantChatBodySchema = z.strictObject({
  conversationId: z.uuid(),
  messages: z
    .array(staffAssistantChatMessageSchema)
    .min(1)
    .max(STAFF_ASSISTANT_CHAT_MESSAGES_MAX),
});

export type StaffAssistantChatMessage = z.infer<
  typeof staffAssistantChatMessageSchema
>;

export type StaffAssistantChatBody = z.infer<
  typeof staffAssistantChatBodySchema
>;

/**
 * Drop client-supplied system messages. The mount always uses
 * `staffAssistantSystemPrompt` instead.
 */
export function staffAssistantModelMessages(
  messages: readonly StaffAssistantChatMessage[],
): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }
    const text = textFromParts(message.parts);
    if (text === "") {
      continue;
    }
    modelMessages.push({ role: message.role, content: text });
  }
  return modelMessages;
}

export function lastStaffAssistantUserText(
  messages: readonly StaffAssistantChatMessage[],
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message === undefined || message.role !== "user") {
      continue;
    }
    const text = textFromParts(message.parts);
    if (text !== "") {
      return text;
    }
  }
  return undefined;
}

/**
 * Resume scoping: bind `x-confirmation-challenge-id` only to the action
 * named on the matching `data-confirmation` part (core.md §7).
 */
export function pausedActionNameForChallenge(
  messages: readonly StaffAssistantChatMessage[],
  challengeId: string,
): string | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      const confirmation = confirmationFromChatPart(part);
      if (confirmation?.challengeId === challengeId) {
        return confirmation.actionName;
      }
    }
  }
  return undefined;
}
