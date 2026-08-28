import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { groupAuditTarget } from "../services/group-audit-target.js";
import { updateStaffGroup } from "../services/update-group.js";
import { updateGroupContract } from "./update-group.contract.js";

export const updateGroup = implementAction(updateGroupContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.updateGroup expects staff");
    }
    return updateStaffGroup({ ctx, input });
  },
  auditTarget: groupAuditTarget,
});
