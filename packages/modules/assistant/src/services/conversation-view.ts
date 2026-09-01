import {
  assistantConversations,
  assistantMessages,
  assistantToolRuns,
} from "@showzy/db/schema/assistant";
import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import type { InferColumnsDataTypes } from "drizzle-orm";
import type { z } from "zod";

import {
  messageRoleSchema,
  toolRunOutcomeSchema,
  type conversationViewSchema,
  type messageViewSchema,
  type toolRunViewSchema,
} from "../actions/conversation-view.contract.js";

type ConversationView = z.output<typeof conversationViewSchema>;
type MessageView = z.output<typeof messageViewSchema>;
type ToolRunView = z.output<typeof toolRunViewSchema>;

export const conversationColumns = {
  id: assistantConversations.id,
  userId: assistantConversations.userId,
  title: assistantConversations.title,
  createdAt: assistantConversations.createdAt,
  updatedAt: assistantConversations.updatedAt,
};

export const messageColumns = {
  id: assistantMessages.id,
  conversationId: assistantMessages.conversationId,
  role: assistantMessages.role,
  body: assistantMessages.body,
  createdAt: assistantMessages.createdAt,
};

export const toolRunColumns = {
  id: assistantToolRuns.id,
  conversationId: assistantToolRuns.conversationId,
  actionName: assistantToolRuns.actionName,
  toolCallId: assistantToolRuns.toolCallId,
  challengeId: assistantToolRuns.challengeId,
  resultIds: assistantToolRuns.resultIds,
  outcome: assistantToolRuns.outcome,
  createdAt: assistantToolRuns.createdAt,
};

export type ConversationRow = InferColumnsDataTypes<typeof conversationColumns>;
export type MessageRow = InferColumnsDataTypes<typeof messageColumns>;
export type ToolRunRow = InferColumnsDataTypes<typeof toolRunColumns>;

export function toConversationView(row: ConversationRow): ConversationView {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMessageView(row: MessageRow): MessageView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: parseDbEnum(
      messageRoleSchema,
      row.role,
      `assistant_messages row ${row.id} has illegal role "${row.role}"`,
    ),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toToolRunView(row: ToolRunRow): ToolRunView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    actionName: row.actionName,
    toolCallId: row.toolCallId,
    challengeId: row.challengeId,
    resultIds: [...row.resultIds],
    outcome: parseDbEnum(
      toolRunOutcomeSchema,
      row.outcome,
      `assistant_tool_runs row ${row.id} has illegal outcome "${row.outcome}"`,
    ),
    createdAt: row.createdAt.toISOString(),
  };
}
