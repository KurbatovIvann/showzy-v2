/**
 * UI affordance mapping from the caller's verified membership
 * (`companies.listMine`): owners hold every permission implicitly;
 * other roles consult the server-resolved `permissions` array. Missing
 * or stale arrays do not fall back to granting every role. This only
 * hides controls — the server re-checks every action permission and stays
 * authoritative (ADR-0013).
 */
import { isOpenOrderStatus, type OrderLifecycleStatus } from "./order-status";

export type CompanyRole = "owner" | "admin" | "manager" | "employee";

export const ORDER_CREATE_PERMISSION = "orders:create";
export const ORDER_EDIT_PERMISSION = "orders:edit";
export const FILES_VIEW_PERMISSION = "files:view";

export type MembershipCapability = {
  readonly role: string;
  readonly permissions?: readonly string[] | null;
};

export function isCompanyRole(value: string): value is CompanyRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "employee"
  );
}

/**
 * Owner-all short-circuit, then the resolved key list. Unknown role or
 * missing permissions deny. Do not re-implement deny/grant/default
 * precedence here — the server already resolved it.
 */
export function membershipHasPermission(
  membership: MembershipCapability,
  permission: string,
): boolean {
  if (!isCompanyRole(membership.role)) {
    return false;
  }
  if (membership.role === "owner") {
    return true;
  }
  const permissions = membership.permissions;
  if (permissions === undefined || permissions === null) {
    return false;
  }
  return permissions.includes(permission);
}

/**
 * `orders:create` — hides the plus control / create submit when the
 * membership is not granted the permission.
 */
export function canCreateOrders(membership: MembershipCapability): boolean {
  return membershipHasPermission(membership, ORDER_CREATE_PERMISSION);
}

/**
 * `orders:edit` — hides confirm / start / complete / cancel. Status
 * writes use the same action permission those contracts declare.
 */
export function canEditOrders(membership: MembershipCapability): boolean {
  return membershipHasPermission(membership, ORDER_EDIT_PERMISSION);
}

/**
 * `files:view` — skips `files.getDownloadUrls` calls that would 403.
 */
export function canFetchFileDownloadUrls(
  membership: MembershipCapability,
): boolean {
  return membershipHasPermission(membership, FILES_VIEW_PERMISSION);
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
