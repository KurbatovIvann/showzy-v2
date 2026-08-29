/**
 * UI affordance mapping from the verified membership role
 * (`companies.listMine`) to the seeded permission defaults
 * (`packages/db/seed/role-permission-defaults.ts`): owners hold every
 * permission implicitly; admin and manager have `documents:view`,
 * `documents:create`, and `documents:edit`; employees have
 * `documents:view` only. This only hides controls and skips doomed
 * requests — the server re-checks every action permission and stays
 * authoritative (ADR-0013).
 */
import type { CompanyMembership } from "../../../api/company-membership-query";

export type CompanyRole = CompanyMembership["role"];

/** `documents:view` — seeded for every staff role including employee. */
export function canViewDocuments(role: CompanyRole): boolean {
  switch (role) {
    case "owner":
    case "admin":
    case "manager":
    case "employee":
      return true;
  }
}

/**
 * `documents:create` — hides the plus control. Employees hold view only.
 */
export function canCreateDocuments(role: CompanyRole): boolean {
  return role !== "employee";
}

/**
 * `documents:edit` — hides share / QR / print / cancel. Open PDF stays
 * on `documents:view`. Employees hold view only.
 */
export function canEditDocuments(role: CompanyRole): boolean {
  return role !== "employee";
}

/**
 * Affordance-only: create submit hides without `documents:create`.
 * Server stays authoritative.
 */
export function documentsCreateScreenActions(args: {
  readonly canCreate: boolean;
}): {
  readonly showSubmit: boolean;
} {
  return { showSubmit: args.canCreate };
}
