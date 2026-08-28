import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { customerAuditTarget } from "../services/customer-audit-target.js";
import { updateStaffCustomer } from "../services/update-customer.js";
import { updateCustomerContract } from "./update-customer.contract.js";

export const updateCustomer = implementAction(updateCustomerContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.updateCustomer expects staff");
    }
    return updateStaffCustomer({ ctx, input });
  },
  auditTarget: customerAuditTarget,
});
