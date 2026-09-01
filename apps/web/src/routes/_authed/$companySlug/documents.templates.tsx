import { createFileRoute } from "@tanstack/react-router";

import { DocumentsSectionLayout } from "../../../features/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/documents/templates",
)({
  component: DocumentsTemplatesRoute,
});

function DocumentsTemplatesRoute() {
  const { companySlug } = Route.useParams();
  return <DocumentsSectionLayout companySlug={companySlug} />;
}
