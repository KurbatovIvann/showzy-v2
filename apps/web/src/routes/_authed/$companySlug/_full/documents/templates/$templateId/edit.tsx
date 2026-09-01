import { createFileRoute } from "@tanstack/react-router";

import { FullShellPlaceholderPage } from "../../../../../../../features/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_full/documents/templates/$templateId/edit",
)({
  component: TemplateEditorRoute,
});

function TemplateEditorRoute() {
  const { companySlug } = Route.useParams();
  return <FullShellPlaceholderPage companySlug={companySlug} />;
}
