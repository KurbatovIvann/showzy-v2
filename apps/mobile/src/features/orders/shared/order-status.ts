/** Lifecycle CHECK values (`new` | `confirmed` | `in_progress` | `done` | `canceled`). */
export const ORDER_LIFECYCLE_STATUSES = [
  "new",
  "confirmed",
  "in_progress",
  "done",
  "canceled",
] as const;

export type OrderLifecycleStatus = (typeof ORDER_LIFECYCLE_STATUSES)[number];

/** Assignable to `StatusPillTone` for the tones this surface uses. */
export type OrderStatusTone = "action" | "attention" | "success" | "danger";

export function isOrderLifecycleStatus(
  value: unknown,
): value is OrderLifecycleStatus {
  return (
    value === "new" ||
    value === "confirmed" ||
    value === "in_progress" ||
    value === "done" ||
    value === "canceled"
  );
}

/** Open statuses: Active group and cancel-enabled. Never `done` / `canceled`. */
export function isOpenOrderStatus(status: OrderLifecycleStatus): boolean {
  return status === "new" || status === "confirmed" || status === "in_progress";
}

export function orderStatusTone(status: OrderLifecycleStatus): OrderStatusTone {
  switch (status) {
    case "new":
    case "confirmed":
      return "action";
    case "in_progress":
      return "attention";
    case "done":
      return "success";
    case "canceled":
      return "danger";
  }
}
