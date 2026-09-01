import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffActorContract } from "./get-staff-actor.contract.js";

export const getStaffActor = implementAction(getStaffActorContract, {
  handler: (_input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("assistant.getStaffActor expects staff");
    }
    return Promise.resolve({
      role: ctx.membership.role,
      permissions: [...ctx.membership.permissions],
    });
  },
});
