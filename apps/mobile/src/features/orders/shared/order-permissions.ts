/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; admin, manager, and employee are seeded
 * `orders:view` and `orders:create`. This only hides controls — the
 * server re-checks every action permission and stays authoritative
 * (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/** `orders:view` — seeded for every staff role including employee. */
export function canViewOrders(role: CompanyRole): boolean {
  switch (role) {
    case "owner":
    case "admin":
    case "manager":
    case "employee":
      return true;
  }
}

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

/** View-model flag the header and empty CTA consult. */
export function ordersHeaderActions(args: {
  readonly canCreate: boolean;
}): { readonly showCreate: boolean } {
  return { showCreate: args.canCreate };
}
