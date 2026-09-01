import { createFileRoute } from "@tanstack/react-router";

import { PANEL_DETAIL } from "../../../../../layouts/panel/panel-route-state";
import { SectionDetailRoutePage } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/products/new",
)({
  staticData: PANEL_DETAIL,
  component: SectionDetailRoutePage,
});
