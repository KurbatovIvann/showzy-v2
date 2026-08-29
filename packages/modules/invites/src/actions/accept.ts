import { implementAction } from "@showzy/core";
import { z } from "zod";

import { invitesAccepted } from "../events/accepted.js";
import {
  acceptCustomerInvite,
  assertCustomerAcceptCtx,
  resolveAcceptInviteTarget,
} from "../services/accept-invite.js";
import { acceptInviteContract } from "./accept.contract.js";

const inviteIdHolder = z.object({ inviteId: z.string() });

export const acceptInvite = implementAction(acceptInviteContract, {
  resolveTarget: (input, env) => resolveAcceptInviteTarget(input, env),
  handler: async (_input, ctx) => {
    assertCustomerAcceptCtx(ctx);
    const result = await acceptCustomerInvite({ ctx });
    if (!result.replayed) {
      ctx.emit(invitesAccepted, {
        aggregate: { type: "invite", id: result.inviteId },
        payload: {
          inviteId: result.inviteId,
          customerId: result.customerId,
          created: result.created,
        },
      });
    }
    return {
      inviteId: result.inviteId,
      customerId: result.customerId,
      created: result.created,
    };
  },
  auditTarget: (env) => {
    const fromOutput = inviteIdHolder.safeParse(env.output);
    return {
      type: "invite",
      id: fromOutput.success ? fromOutput.data.inviteId : "uncreated",
    };
  },
});
