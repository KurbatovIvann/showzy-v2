import { createFileRoute } from "@tanstack/react-router";

import { validateOrdersSearch } from "../../../../../features/orders/api/orders-list-search";
import { PANEL_DETAIL } from "../../../../../layouts/panel/panel-route-state";
import { SectionDetailRoutePage } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/orders/$orderId",
)({
  validateSearch: validateOrdersSearch,
  staticData: PANEL_DETAIL,
  component: SectionDetailRoutePage,
});
