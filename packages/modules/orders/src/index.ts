import { cancelOrder } from "./actions/cancel.js";
import { confirmOrder } from "./actions/confirm.js";
import { createOrder } from "./actions/create.js";
import { getOrder } from "./actions/get.js";
import { listOrders } from "./actions/list.js";

export { cancelOrder };
export { confirmOrder };
export { createOrder };
export { getOrder };
export { listOrders };
export { ordersCanceled } from "./events/canceled.js";
export { ordersConfirmed } from "./events/confirmed.js";
export { ordersCreated } from "./events/created.js";

export const ordersActions = [
  createOrder,
  confirmOrder,
  cancelOrder,
  getOrder,
  listOrders,
] as const;
