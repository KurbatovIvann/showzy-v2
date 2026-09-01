import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffConversation } from "../services/get-conversation.js";
import { getConversationContract } from "./get-conversation.contract.js";

export const getConversation = implementAction(getConversationContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("assistant.getConversation expects staff");
    }
    return getStaffConversation({
      ctx,
      conversationId: input.conversationId,
    });
  },
});
