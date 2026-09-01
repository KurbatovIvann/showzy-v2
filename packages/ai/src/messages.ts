import type { ModelMessage } from "ai";
import { z } from "zod";

const chatPartSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
});

export const staffAssistantChatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(chatPartSchema).default([]),
});

export const staffAssistantChatBodySchema = z.strictObject({
  conversationId: z.uuid(),
  messages: z.array(staffAssistantChatMessageSchema).min(1),
});

export type StaffAssistantChatMessage = z.infer<
  typeof staffAssistantChatMessageSchema
>;

export type StaffAssistantChatBody = z.infer<
  typeof staffAssistantChatBodySchema
>;

function textFromParts(parts: StaffAssistantChatMessage["parts"]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("");
}

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
