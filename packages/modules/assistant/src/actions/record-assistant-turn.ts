import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { conversationAuditTarget } from "../services/conversation-audit-target.js";
import { recordStaffAssistantTurn } from "../services/record-assistant-turn.js";
import { recordAssistantTurnContract } from "./record-assistant-turn.contract.js";

export const recordAssistantTurn = implementAction(
  recordAssistantTurnContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "assistant.recordAssistantTurn expects staff",
        );
      }
      return recordStaffAssistantTurn({ ctx, input });
    },
    auditTarget: conversationAuditTarget,
  },
);
