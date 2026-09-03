import { createFileRoute } from "@tanstack/react-router";

import { validateOrdersSearch } from "../../../../../features/orders/api/orders-list-search";
import { OrdersEmptySelectionPage } from "../../../../../features/orders/list/orders-empty-selection-page";

export const Route = createFileRoute("/_authed/$companySlug/_panel/orders/")({
  validateSearch: validateOrdersSearch,
  component: OrdersEmptySelectionPage,
});
