/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; employees lack `products:create` and
 * `files:view`. This only hides controls and skips doomed requests —
 * the server re-checks every action permission and stays authoritative
 * (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/** `products:create` — hides the create control for employees. */
export function canCreateProducts(role: CompanyRole): boolean {
  return role !== "employee";
}

/** `files:view` — skips per-row `files.getDownloadUrl` calls that would 403. */
export function canFetchFileDownloadUrls(role: CompanyRole): boolean {
  return role !== "employee";
}
