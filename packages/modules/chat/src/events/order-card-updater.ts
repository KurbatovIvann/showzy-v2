import { defineEventHandler } from "@showzy/core";
import { ordersConfirmed, ordersCreated } from "@showzy/orders";

import { upsertOrderCard } from "../actions/upsert-order-card.js";

export const ORDER_CARD_UPDATER_CONSUMER = "chat.order-card-updater";

export const orderCardUpdaterCreated = defineEventHandler({
  event: ordersCreated,
  consumer: ORDER_CARD_UPDATER_CONSUMER,
  action: upsertOrderCard,
});

export const orderCardUpdaterConfirmed = defineEventHandler({
  event: ordersConfirmed,
  consumer: ORDER_CARD_UPDATER_CONSUMER,
  action: upsertOrderCard,
});

/** Same objects the API composition root and the worker must both register. */
export const orderCardUpdaterSubscriptions = [
  orderCardUpdaterCreated,
  orderCardUpdaterConfirmed,
] as const;
