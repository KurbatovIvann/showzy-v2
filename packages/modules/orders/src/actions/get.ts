import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getOrderContract } from "./get.contract.js";
import { loadStaffOrder } from "../services/load-order.js";

export const getOrder = implementAction(getOrderContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.get expects staff");
    }
    return loadStaffOrder({
      db: ctx.db,
      companyId: ctx.companyId,
      orderId: input.orderId,
    });
  },
});
