import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const ordersConfirmed = defineEvent({
  name: "orders.confirmed",
  version: 1,
  scope: "tenant",
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.uuid().nullable(),
    confirmedAt: z.iso.datetime(),
  }),
});
