import { Link } from "@tanstack/react-router";

import { cx } from "../../../components/ui/cx";
import type { CompanyScopeCopy } from "../../../i18n/companies/company-scope";
import type { MemberRoleCopy } from "../../../i18n/panel/chrome";
import type { CompanyMembership } from "../api/list-mine";

export function CompanySwitcher(props: {
  readonly copy: CompanyScopeCopy;
  readonly roles: MemberRoleCopy;
  readonly current: CompanyMembership;
  readonly memberships: readonly CompanyMembership[];
}) {
  return (
    <nav aria-label={props.copy.switcher} className="p-3">
      <div className="flex items-center gap-3 rounded-card px-3 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-[14px] font-semibold text-ink">
          {props.current.company.prefix}
        </span>
        <span className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-ink">
            {props.current.company.name}
          </h1>
          <span className="block text-[13px] text-muted">
            {props.roles[props.current.role]}
          </span>
        </span>
      </div>
      {props.memberships.length > 1 ? (
        <ul className="mt-1 space-y-1">
          {props.memberships.map((membership) => {
            const current = membership.company.id === props.current.company.id;
            if (current) {
              return null;
            }
            return (
              <li key={membership.membershipId}>
                <Link
                  className={cx(
                    "flex w-full rounded-full px-3 py-1.5 text-[13px] text-muted",
                    "hover:bg-canvas hover:text-ink",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                  )}
                  params={{ companySlug: membership.company.slug }}
                  to="/$companySlug"
                >
                  {membership.company.name}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}
