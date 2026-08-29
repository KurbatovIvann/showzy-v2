import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { inviteAuditTarget } from "../services/invite-audit-target.js";
import { revokeStaffInvite } from "../services/revoke-invite.js";
import { requireWritable } from "../services/writable.js";
import { invitesRevoked } from "../events/revoked.js";
import { revokeInviteContract } from "./revoke.contract.js";

export const revokeInvite = implementAction(revokeInviteContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("invites.revoke expects staff");
    }

    const result = await revokeStaffInvite({
      db: requireWritable(ctx.db),
      companyId: ctx.companyId,
      inviteId: input.id,
    });

    if (result.changed) {
      ctx.emit(invitesRevoked, {
        aggregate: { type: "invite", id: result.view.id },
        payload: { inviteId: result.view.id },
      });
      ctx.log.info(
        { invite_id: result.view.id },
        "invites.revoke revoked invite",
      );
    }

    return result.view;
  },
  auditTarget: inviteAuditTarget,
});
