import type { ActionCtx } from "@showzy/core";
import { assistantConversations } from "@showzy/db/schema/assistant";
import { and, eq } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;

export async function touchConversation(env: {
  readonly db: WritableStaffDb;
  readonly companyId: StaffCtx["companyId"];
  readonly conversationId: string;
}): Promise<void> {
  await env.db
    .update(assistantConversations)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(assistantConversations.companyId, env.companyId),
        eq(assistantConversations.id, env.conversationId),
      ),
    );
}
