import { createFileRoute } from "@tanstack/react-router";

import { CompanyHomeScreen } from "../../../features/companies/home/company-home-screen";

export const Route = createFileRoute("/_authed/$companySlug/")({
  component: CompanyHomeRoute,
});

function CompanyHomeRoute() {
  const { companySlug } = Route.useParams();
  return <CompanyHomeScreen companySlug={companySlug} />;
}
