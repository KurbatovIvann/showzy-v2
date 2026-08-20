import { defineEvent } from "@showzy/core";
import { z } from "zod";

import { moneyWireSchema } from "../wire.contract.js";

export const ordersCreated = defineEvent({
  name: "orders.created",
  version: 1,
  scope: "tenant",
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.uuid(),
    totalGrossMinor: moneyWireSchema,
    currency: z.string().length(3),
    itemCount: z.number().int().positive(),
  }),
});
