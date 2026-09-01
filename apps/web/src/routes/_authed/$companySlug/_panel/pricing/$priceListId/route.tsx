import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PANEL_DETAIL } from "../../../../../../layouts/panel/panel-route-state";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/pricing/$priceListId",
)({
  staticData: PANEL_DETAIL,
  component: Outlet,
});
