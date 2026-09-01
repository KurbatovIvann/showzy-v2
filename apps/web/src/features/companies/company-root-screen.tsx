import { Link, Navigate } from "@tanstack/react-router";

import { Card } from "../../components/ui/card";
import { createBrowserCompanyPrefs } from "../../prefs/companies/company-prefs";
import {
  CompanyScopeError,
  CompanyScopeLoading,
} from "./components/company-scope-status";
import { useCompanyScopeCopy } from "./hooks/use-company-scope-copy";
import { useListMine } from "./hooks/use-list-mine";
import { lastVisitedSlugToRedirect } from "./shared/resolve-company";

const PICKER_LINK_CLASS =
  "inline-flex w-full items-center justify-center rounded-full border border-line " +
  "bg-surface px-5 py-3 text-[15px] font-semibold text-ink hover:bg-canvas " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action";

export function CompanyRootScreen() {
  const copy = useCompanyScopeCopy();
  const listMine = useListMine();

  if (listMine.isPending) {
    return <CompanyScopeLoading label={copy.loading} />;
  }
  if (listMine.isError) {
    return (
      <CompanyScopeError
        copy={copy}
        onRetry={() => {
          void listMine.refetch();
        }}
      />
    );
  }

  const memberships = listMine.data.memberships;
  const redirectSlug = lastVisitedSlugToRedirect(
    memberships,
    createBrowserCompanyPrefs().getLastCompanySlug(),
  );
  if (redirectSlug !== null) {
    return (
      <Navigate
        params={{ companySlug: redirectSlug }}
        replace
        to="/$companySlug"
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <Card className="w-full max-w-[440px] p-6">
        <h1 className="text-lg font-semibold text-ink">{copy.pickerTitle}</h1>
        {memberships.length === 0 ? (
          <>
            <p className="mt-2 text-[15px] font-medium text-ink">
              {copy.emptyTitle}
            </p>
            <p className="mt-1 text-[15px] text-muted">
              {copy.emptyDescription}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-[15px] text-muted">{copy.pickerHint}</p>
            <ul className="mt-5 flex flex-col gap-2">
              {memberships.map((membership) => (
                <li key={membership.membershipId}>
                  <Link
                    className={PICKER_LINK_CLASS}
                    params={{ companySlug: membership.company.slug }}
                    to="/$companySlug"
                  >
                    {membership.company.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </main>
  );
}
