import type { CompanyMembership } from "../api/list-mine";

export function matchMembershipBySlug(
  memberships: readonly CompanyMembership[],
  slug: string,
): CompanyMembership | undefined {
  return memberships.find((membership) => membership.company.slug === slug);
}
