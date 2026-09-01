import { createFileRoute } from "@tanstack/react-router";

import { CompanyLayout } from "../../features/companies/scope/company-layout";

export const Route = createFileRoute("/_authed/$companySlug")({
  component: CompanySlugLayout,
});

function CompanySlugLayout() {
  const { companySlug } = Route.useParams();
  return <CompanyLayout companySlug={companySlug} />;
}
