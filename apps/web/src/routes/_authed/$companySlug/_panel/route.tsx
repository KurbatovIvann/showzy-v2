import { createFileRoute } from "@tanstack/react-router";

import { PanelChromeLayout } from "../../../../layouts/panel/panel-layout";

export const Route = createFileRoute("/_authed/$companySlug/_panel")({
  component: PanelChromeLayoutRoute,
});

function PanelChromeLayoutRoute() {
  const { companySlug } = Route.useParams();
  return <PanelChromeLayout companySlug={companySlug} />;
}
