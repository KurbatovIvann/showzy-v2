import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PANEL_DETAIL } from "../../../../../../features/panel/panel-route-state";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/products/$productId",
)({
  staticData: PANEL_DETAIL,
  component: Outlet,
});
