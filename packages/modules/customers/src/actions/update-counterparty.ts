import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { counterpartyAuditTarget } from "../services/counterparty-audit-target.js";
import { updateStaffCounterparty } from "../services/update-counterparty.js";
import { updateCounterpartyContract } from "./update-counterparty.contract.js";

export const updateCounterparty = implementAction(updateCounterpartyContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError(
        "customers.updateCounterparty expects staff",
      );
    }
    return updateStaffCounterparty({ ctx, input });
  },
  auditTarget: counterpartyAuditTarget,
});
