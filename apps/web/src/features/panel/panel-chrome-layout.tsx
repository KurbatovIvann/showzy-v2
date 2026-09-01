import { Outlet } from "@tanstack/react-router";

import { useCompanyScope } from "../companies/scope/use-company-scope";
import { PanelChrome } from "./panel-chrome";

/**
 * Pathless `_panel` layout: three-pane chrome without adding a URL
 * segment. Full-shell takeovers live under `_full` so this tree unmounts
 * instead of a pathname exception (`docs/design/web-panel-architecture.md`).
 */
export function PanelChromeLayout({
  companySlug,
}: {
  readonly companySlug: string;
}) {
  const scope = useCompanyScope(companySlug);
  if (scope.match === undefined) {
    return null;
  }
  return (
    <PanelChrome
      companySlug={companySlug}
      current={scope.match}
      memberships={scope.memberships}
    >
      <Outlet />
    </PanelChrome>
  );
}
