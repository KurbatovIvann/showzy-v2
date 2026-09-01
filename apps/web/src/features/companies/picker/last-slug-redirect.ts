import type { CompanyMembership } from "../api/list-mine";
import { matchMembershipBySlug } from "../scope/match-membership";

export function lastVisitedSlugToRedirect(
  memberships: readonly CompanyMembership[],
  lastSlug: string | null,
): string | null {
  if (lastSlug === null) {
    return null;
  }
  return matchMembershipBySlug(memberships, lastSlug)?.company.slug ?? null;
}
