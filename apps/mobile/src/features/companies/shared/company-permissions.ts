/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; `settings:payments` is seeded for admin only.
 * Manager and employee are denied. This only hides controls and skips
 * doomed `companies.get` requests — the server re-checks every action
 * permission and stays authoritative (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/**
 * `settings:payments` — owner/admin may open the company settings hub.
 * Manager and employee have no view-only key; hide the More row and
 * skip the get.
 */
export function canViewCompanySettings(role: CompanyRole): boolean {
  return role === "owner" || role === "admin";
}
