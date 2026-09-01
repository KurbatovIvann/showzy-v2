import { Navigate, Outlet, useRouterState } from "@tanstack/react-router";

import { isFullShellPath } from "../../panel/section-path";
import { PanelChrome } from "../../panel/panel-chrome";
import { CompanyScopeError, CompanyScopeLoading } from "./company-scope-status";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  const body = scope.ready ? (
    <Outlet />
  ) : (
    <p className="px-4 py-6 text-[15px] text-muted">{copy.loading}</p>
  );

  if (isFullShellPath(pathname, companySlug)) {
    return body;
  }

  return (
    <PanelChrome
      companySlug={companySlug}
      current={scope.match}
      memberships={scope.memberships}
    >
      {body}
    </PanelChrome>
  );
}
