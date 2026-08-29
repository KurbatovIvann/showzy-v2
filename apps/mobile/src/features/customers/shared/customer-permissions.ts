/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; employees have `customers:view` only; managers
 * have create/edit but not `customers:delete`. This only hides controls
 * and skips doomed requests — the server re-checks every action
 * permission and stays authoritative (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/** `customers:create` — hides the clients-tab create control. */
export function canCreateCustomers(role: CompanyRole): boolean {
  return role !== "employee";
}

/**
 * `customers:invite` — hides invitations-tab create and row revoke.
 * Seed: owner implicit, admin+manager hold the key, employee does not.
 */
export function canInviteCustomers(role: CompanyRole): boolean {
  return role !== "employee";
}

/**
 * `customers:edit` — hides archive/restore, client edit, group create,
 * group edit, group delete, and counterparty create/edit/delete.
 */
export function canEditCustomers(role: CompanyRole): boolean {
  return role !== "employee";
}

/** `customers:delete` — hides hard-delete on an archived client. */
export function canDeleteCustomers(role: CompanyRole): boolean {
  return role === "owner" || role === "admin";
}
