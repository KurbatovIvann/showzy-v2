import type { CompanyMembership } from "../../api/company-membership-query";

export function matchMembershipBySlug(
  memberships: readonly CompanyMembership[],
  slug: string,
): CompanyMembership | undefined {
  return memberships.find((membership) => membership.company.slug === slug);
}

export function lastVisitedSlugToRedirect(
  memberships: readonly CompanyMembership[],
  lastSlug: string | null,
): string | null {
  if (lastSlug === null) {
    return null;
  }
  return matchMembershipBySlug(memberships, lastSlug)?.company.slug ?? null;
}
