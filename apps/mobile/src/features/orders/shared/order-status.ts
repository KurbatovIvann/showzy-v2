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
export type OrderStatusTone =
  "action" | "focus" | "attention" | "success" | "danger";

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

export function orderStatusTone(status: OrderLifecycleStatus): OrderStatusTone {
  switch (status) {
    case "new":
      return "action";
    case "confirmed":
      return "focus";
    case "in_progress":
      return "attention";
    case "done":
      return "success";
    case "canceled":
      return "danger";
  }
}

/** List Активні + cancel-eligible (non-terminal) CHECK values. */
export function isOpenOrderStatus(status: OrderLifecycleStatus): boolean {
  switch (status) {
    case "new":
    case "confirmed":
    case "in_progress":
      return true;
    case "done":
    case "canceled":
      return false;
  }
}

export function isClosedOrderStatus(status: OrderLifecycleStatus): boolean {
  return !isOpenOrderStatus(status);
}
