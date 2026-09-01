import { createFileRoute } from "@tanstack/react-router";

import { CompanyHomeScreen } from "../../../../features/companies/home/company-home-screen";

export const Route = createFileRoute("/_authed/$companySlug/_panel/")({
  component: CompanyHomeRoute,
});

function CompanyHomeRoute() {
  return <CompanyHomeScreen />;
}
