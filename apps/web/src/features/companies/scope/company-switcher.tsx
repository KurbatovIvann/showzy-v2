import { Link } from "@tanstack/react-router";

import { cx } from "../../../components/ui/cx";
import type { CompanyScopeCopy } from "../../../i18n/companies/company-scope";
import type { CompanyMembership } from "../api/list-mine";

export function CompanySwitcher(props: {
  readonly copy: CompanyScopeCopy;
  readonly current: CompanyMembership;
  readonly memberships: readonly CompanyMembership[];
}) {
  return (
    <nav
      aria-label={props.copy.switcher}
      className="border-b border-line bg-surface px-4 py-3"
    >
      <p className="text-[13px] text-muted">{props.copy.switcher}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {props.memberships.map((membership) => {
          const current = membership.company.id === props.current.company.id;
          const className = cx(
            "rounded-full px-3 py-1.5 text-[15px]",
            current
              ? "bg-ink font-semibold text-white"
              : "border border-line text-muted hover:text-ink",
          );
          return (
            <li key={membership.membershipId}>
              {current ? (
                <span aria-current="page" className={className}>
                  {membership.company.name}
                </span>
              ) : (
                <Link
                  className={className}
                  params={{ companySlug: membership.company.slug }}
                  to="/$companySlug"
                >
                  {membership.company.name}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
