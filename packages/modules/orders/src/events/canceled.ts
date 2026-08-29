import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const ordersCanceled = defineEvent({
  name: "orders.canceled",
  version: 1,
  scope: "tenant",
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.uuid().nullable(),
  }),
});
