/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; admin, manager, and employee are seeded
 * `orders:edit`. This only hides controls — the server re-checks every
 * action permission and stays authoritative (ADR-0013). Status writes
 * hide without `orders:edit`.
 */
import { isOpenOrderStatus, type OrderLifecycleStatus } from "./order-status";

export type CompanyRole = "owner" | "admin" | "manager" | "employee";

/**
 * `orders:edit` — hides confirm / start / complete / cancel. Every
 * seeded staff role currently holds edit (owner implicit). Prove the
 * hide path with `orderDetailActions({ canEdit: false })`.
 */
export function canEditOrders(role: CompanyRole): boolean {
  switch (role) {
    case "owner":
    case "admin":
    case "manager":
    case "employee":
      return true;
  }
}

export type OrderDetailPrimaryWrite = "confirm" | "start" | "complete";

export type OrderDetailActions = {
  readonly showConfirm: boolean;
  readonly showStart: boolean;
  readonly showComplete: boolean;
  readonly showActions: boolean;
  readonly cancelEnabled: boolean;
};

const HIDDEN_DETAIL_WRITES: OrderDetailActions = {
  showConfirm: false,
  showStart: false,
  showComplete: false,
  showActions: false,
  cancelEnabled: false,
};

/**
 * Primary footer write for the current CHECK status. Terminal statuses
 * have no primary CTA.
 */
export function orderDetailPrimaryWrite(
  status: OrderLifecycleStatus,
): OrderDetailPrimaryWrite | null {
  switch (status) {
    case "new":
      return "confirm";
    case "confirmed":
      return "start";
    case "in_progress":
      return "complete";
    case "done":
    case "canceled":
      return null;
  }
}

/**
 * Affordance-only: one primary CTA per open status; cancel lives in the
 * ⋯ menu for open statuses. Without `orders:edit` every write hides.
 * Server stays authoritative.
 */
export function orderDetailActions(args: {
  readonly canEdit: boolean;
  readonly status: OrderLifecycleStatus;
}): OrderDetailActions {
  if (!args.canEdit) {
    return HIDDEN_DETAIL_WRITES;
  }
  const primary = orderDetailPrimaryWrite(args.status);
  return {
    showConfirm: primary === "confirm",
    showStart: primary === "start",
    showComplete: primary === "complete",
    showActions: isOpenOrderStatus(args.status),
    cancelEnabled: isOpenOrderStatus(args.status),
  };
}
