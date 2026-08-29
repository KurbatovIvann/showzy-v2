/** Lifecycle CHECK values (`new` / `confirmed` / `canceled`). */
export type OrderLifecycleStatus = "new" | "confirmed" | "canceled";

export type OrderStatusTone = "action" | "danger";

export function orderStatusTone(status: OrderLifecycleStatus): OrderStatusTone {
  return status === "canceled" ? "danger" : "action";
}
