import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { appendStaffUserMessage } from "../services/append-user-message.js";
import { conversationAuditTarget } from "../services/conversation-audit-target.js";
import { appendUserMessageContract } from "./append-user-message.contract.js";

export const appendUserMessage = implementAction(appendUserMessageContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("assistant.appendUserMessage expects staff");
    }
    return appendStaffUserMessage({ ctx, input });
  },
  auditTarget: conversationAuditTarget,
});
