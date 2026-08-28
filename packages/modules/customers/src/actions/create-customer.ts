import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { customerAuditTarget } from "../services/customer-audit-target.js";
import { createStaffCustomer } from "../services/create-customer.js";
import { createCustomerContract } from "./create-customer.contract.js";

export const createCustomer = implementAction(createCustomerContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("customers.createCustomer expects staff");
    }
    return createStaffCustomer({ ctx, input });
  },
  auditTarget: customerAuditTarget,
});
