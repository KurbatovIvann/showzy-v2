import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { executeListOrders } from "../services/order-list/index.js";
import { listOrdersContract } from "./list.contract.js";

export const listOrders = implementAction(listOrdersContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.list expects staff");
    }
    return executeListOrders(input, ctx);
  },
});
