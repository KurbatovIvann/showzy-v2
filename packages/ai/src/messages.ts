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
  parts: ReadonlyArray<{ type: string; text?: string | undefined }>,
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
        message: `Message text must be at most ${String(STAFF_ASSISTANT_CHAT_MESSAGE_TEXT_MAX)} characters.`,
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

export interface StaffUserMessageAttempt {
  readonly id: string;
  readonly text: string;
}

export function lastStaffAssistantUserMessage(
  messages: readonly StaffAssistantChatMessage[],
): StaffUserMessageAttempt | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message === undefined || message.role !== "user") {
      continue;
    }
    const text = textFromParts(message.parts);
    if (text !== "") {
      return { id: message.id, text };
    }
  }
  return undefined;
}

/**
 * HITL paused context: the action the human confirmed and the tool-call
 * id of that logical attempt. Used to pin `idempotencyKey` on resume;
 * tracing still uses the provider `toolCallId`.
 */
export interface PausedToolAttempt {
  readonly actionName: string;
  readonly toolCallId: string;
}

export type PausedToolAttemptResolution =
  | { readonly status: "ok"; readonly attempt: PausedToolAttempt }
  | { readonly status: "missing" }
  | { readonly status: "mismatch" };

/**
 * Client envelope: matching `data-confirmation` part (core.md §7).
 */
export function pausedToolAttemptForChallenge(
  messages: readonly StaffAssistantChatMessage[],
  challengeId: string,
): PausedToolAttempt | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      const confirmation = confirmationFromChatPart(part);
      if (confirmation?.challengeId === challengeId) {
        return {
          actionName: confirmation.actionName,
          toolCallId: confirmation.toolCallId,
        };
      }
    }
  }
  return undefined;
}

export interface StaffAssistantToolRunRef {
  readonly actionName: string;
  readonly toolCallId: string;
  readonly challengeId: string | null;
  readonly outcome: string;
}

/**
 * Server-authoritative paused attempt from `assistant.getConversation`
 * tool-run rows.
 */
export function pausedToolAttemptFromToolRuns(
  toolRuns: readonly StaffAssistantToolRunRef[],
  challengeId: string,
): PausedToolAttempt | undefined {
  for (let index = toolRuns.length - 1; index >= 0; index -= 1) {
    const run = toolRuns[index];
    if (
      run !== undefined &&
      run.outcome === "confirmation_required" &&
      run.challengeId === challengeId
    ) {
      return {
        actionName: run.actionName,
        toolCallId: run.toolCallId,
      };
    }
  }
  return undefined;
}

/**
 * Resume uses persisted rows when present, the client envelope when the
 * card streamed before persist finished, and rejects a forged/stale
 * envelope that disagrees with the server.
 */
export function resolvePausedToolAttempt(
  persisted: PausedToolAttempt | undefined,
  client: PausedToolAttempt | undefined,
): PausedToolAttemptResolution {
  if (persisted !== undefined && client !== undefined) {
    if (
      persisted.actionName !== client.actionName ||
      persisted.toolCallId !== client.toolCallId
    ) {
      return { status: "mismatch" };
    }
    return { status: "ok", attempt: persisted };
  }
  if (persisted !== undefined) {
    return { status: "ok", attempt: persisted };
  }
  if (client !== undefined) {
    return { status: "ok", attempt: client };
  }
  return { status: "missing" };
}
