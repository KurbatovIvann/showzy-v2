/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; admin, manager, and employee are seeded
 * `orders:view`, `orders:create`, and `orders:edit`. This only hides
 * controls — the server re-checks every action permission and stays
 * authoritative (ADR-0013). The list always loads; there is no
 * view-gate affordance. Confirm/cancel hide without `orders:edit`.
 */
import type { CompanyMembership } from "../../../api/company-membership-query";
import type { OrderLifecycleStatus } from "./order-status";

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
 * `orders:edit` — hides confirm and cancel. Every seeded staff role
 * currently holds edit (owner implicit). Prove the hide path with
 * `orderDetailActions({ canEdit: false })`.
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

export type OrderDetailActions = {
  readonly showConfirm: boolean;
  readonly showActions: boolean;
  readonly cancelEnabled: boolean;
};

/**
 * Affordance-only: confirm is the primary CTA on `new`; cancel lives in
 * the actions sheet for `new` / `confirmed` and is disabled when already
 * `canceled`. Without `orders:edit` both hide. Server stays authoritative.
 */
export function orderDetailActions(args: {
  readonly canEdit: boolean;
  readonly status: OrderLifecycleStatus;
}): OrderDetailActions {
  if (!args.canEdit) {
    return {
      showConfirm: false,
      showActions: false,
      cancelEnabled: false,
    };
  }
  return {
    showConfirm: args.status === "new",
    showActions: true,
    cancelEnabled: args.status !== "canceled",
  };
}
