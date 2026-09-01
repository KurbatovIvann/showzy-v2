import { Navigate, Outlet } from "@tanstack/react-router";

import { CompanyScopeError, CompanyScopeLoading } from "./company-scope-status";
import { CompanySwitcher } from "./company-switcher";
import { CompanyUnknownScreen } from "./company-unknown-screen";
import { useCompanyScope } from "./use-company-scope";
import { useCompanyScopeCopy } from "./use-company-scope-copy";

export function CompanyLayout({
  companySlug,
}: {
  readonly companySlug: string;
}) {
  const copy = useCompanyScopeCopy();
  const scope = useCompanyScope(companySlug);

  if (scope.listMine.isPending) {
    return <CompanyScopeLoading label={copy.loading} />;
  }
  if (scope.listMine.isError) {
    return (
      <CompanyScopeError
        copy={copy}
        onRetry={() => {
          void scope.listMine.refetch();
        }}
      />
    );
  }
  if (scope.memberships.length === 0) {
    return <Navigate replace to="/" />;
  }
  if (scope.match === undefined) {
    return <CompanyUnknownScreen />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <CompanySwitcher
        copy={copy}
        current={scope.match}
        memberships={scope.memberships}
      />
      {scope.ready ? (
        <Outlet />
      ) : (
        <p className="px-4 py-6 text-[15px] text-muted">{copy.loading}</p>
      )}
    </div>
  );
}
