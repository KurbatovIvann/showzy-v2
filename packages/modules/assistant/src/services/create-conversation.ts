import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { assistantConversations } from "@showzy/db/schema/assistant";
import type { z } from "zod";

import type {
  createConversationInputSchema,
  createConversationOutputSchema,
} from "../actions/create-conversation.contract.js";
import {
  conversationColumns,
  toConversationView,
} from "./conversation-view.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type CreateInput = z.output<typeof createConversationInputSchema>;
type ConversationView = z.output<typeof createConversationOutputSchema>;

export async function createStaffConversation(env: {
  readonly ctx: StaffCtx;
  readonly input: CreateInput;
}): Promise<ConversationView> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);
  const conversationId = randomUUID();

  const inserted = (
    await db
      .insert(assistantConversations)
      .values({
        id: conversationId,
        companyId: ctx.companyId,
        userId: ctx.userId,
        title: input.title,
      })
      .returning(conversationColumns)
  )[0];
  if (inserted === undefined) {
    throw new CoreInvariantError(
      "assistant.createConversation insert returned no row",
    );
  }

  ctx.log.info(
    { conversation_id: inserted.id },
    "assistant.createConversation created conversation",
  );
  return toConversationView(inserted);
}
