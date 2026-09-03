/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; admin, manager, and employee are seeded
 * `orders:view`, `orders:create`, and `orders:edit`. This only hides
 * controls — the server re-checks every action permission and stays
 * authoritative (ADR-0013). The list always loads; there is no
 * view-gate affordance. Status writes hide without `orders:edit`.
 */
import type { CompanyMembership } from "../../../api/company-membership-query";
import { isOpenOrderStatus, type OrderLifecycleStatus } from "./order-status";

export type CompanyRole = CompanyMembership["role"];

/**
 * `orders:create` — hides the plus control when the role is not granted
 * the permission. Every seeded staff role currently holds create.
 */
export function canCreateOrders(role: CompanyRole): boolean {
  switch (role) {
    case "owner":
    case "admin":
    case "manager":
    case "employee":
      return true;
  }
}

/**
 * `files:view` — skips `files.getDownloadUrls` calls that would 403.
 * Employees are not seeded that permission (same as catalog photos).
 */
export function canFetchFileDownloadUrls(role: CompanyRole): boolean {
  return role !== "employee";
}

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

/** View-model flag the header and empty CTA consult. */
export function ordersHeaderActions(args: { readonly canCreate: boolean }): {
  readonly showCreate: boolean;
} {
  return { showCreate: args.canCreate };
}

/**
 * Affordance-only: create submit hides without `orders:create`. Server
 * stays authoritative.
 */
export function orderCreateScreenActions(args: {
  readonly canCreate: boolean;
}): {
  readonly showSubmit: boolean;
} {
  return { showSubmit: args.canCreate };
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
 * actions sheet for every loaded order and is enabled only while open.
 * Without `orders:edit` every write hides. Server stays authoritative.
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
    showActions: true,
    cancelEnabled: isOpenOrderStatus(args.status),
  };
}
