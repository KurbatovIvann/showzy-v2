import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const ordersStarted = defineEvent({
  name: "orders.started",
  version: 1,
  scope: "tenant",
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.uuid().nullable(),
  }),
});
