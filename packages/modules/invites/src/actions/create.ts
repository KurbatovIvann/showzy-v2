import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { createInviteContract } from "./create.contract.js";
import { inviteAuditTarget } from "../services/invite-audit-target.js";
import { createStaffInvite } from "../services/create-invite.js";

export const createInvite = implementAction(createInviteContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("invites.create expects staff");
    }
    return createStaffInvite({ ctx, input });
  },
  auditTarget: inviteAuditTarget,
});
