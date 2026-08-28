import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { createStaffGroup } from "../services/create-group.js";
import { groupAuditTarget } from "../services/group-audit-target.js";
import { createGroupContract } from "./create-group.contract.js";

export const createGroup = implementAction(createGroupContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.createGroup expects staff");
    }
    return createStaffGroup({ ctx, input });
  },
  auditTarget: groupAuditTarget,
});
