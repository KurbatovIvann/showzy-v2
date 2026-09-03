import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const ordersCompleted = defineEvent({
  name: "orders.completed",
  version: 1,
  scope: "tenant",
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.uuid().nullable(),
  }),
});
