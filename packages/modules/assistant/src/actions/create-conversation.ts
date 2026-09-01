import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { conversationAuditTarget } from "../services/conversation-audit-target.js";
import { createStaffConversation } from "../services/create-conversation.js";
import { createConversationContract } from "./create-conversation.contract.js";

export const createConversation = implementAction(createConversationContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError(
        "assistant.createConversation expects staff",
      );
    }
    return createStaffConversation({ ctx, input });
  },
  auditTarget: conversationAuditTarget,
});
