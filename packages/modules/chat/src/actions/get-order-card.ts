import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getOrderCardContract } from "./get-order-card.contract.js";
import { loadStaffOrderCard } from "../services/load-order-card.js";

export const getOrderCard = implementAction(getOrderCardContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("chat.getOrderCard expects staff");
    }
    return loadStaffOrderCard({
      db: ctx.db,
      companyId: ctx.companyId,
      orderId: input.orderId,
    });
  },
});
