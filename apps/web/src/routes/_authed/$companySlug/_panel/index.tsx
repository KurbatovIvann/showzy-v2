import { createFileRoute } from "@tanstack/react-router";

import { CompanyHomeScreen } from "../../../../features/companies/home/company-home-screen";

export const Route = createFileRoute("/_authed/$companySlug/_panel/")({
  staticData: {
    panel: {
      panelSection: "orders",
      pane: "list",
      listTo: "/$companySlug/orders",
    },
  },
  component: CompanyHomeRoute,
});

function CompanyHomeRoute() {
  return <CompanyHomeScreen />;
}
