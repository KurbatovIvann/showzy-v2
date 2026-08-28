/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; employees have `pricing:view` only; admin and
 * manager have `pricing:manage`. This only hides controls and skips
 * doomed requests — the server re-checks every action permission and
 * stays authoritative (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/** `pricing:view` — seeded for every staff role including employee. */
export function canViewPriceLists(role: CompanyRole): boolean {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "employee"
  );
}

/**
 * `pricing:manage` — hides create, edit, default/active, and delete.
 * Employees hold view only.
 */
export function canManagePriceLists(role: CompanyRole): boolean {
  return role !== "employee";
}
