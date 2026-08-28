import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { counterpartyAuditTarget } from "../services/counterparty-audit-target.js";
import { createStaffCounterparty } from "../services/create-counterparty.js";
import { createCounterpartyContract } from "./create-counterparty.contract.js";

export const createCounterparty = implementAction(createCounterpartyContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError(
        "customers.createCounterparty expects staff",
      );
    }
    return createStaffCounterparty({ ctx, input });
  },
  auditTarget: counterpartyAuditTarget,
});
