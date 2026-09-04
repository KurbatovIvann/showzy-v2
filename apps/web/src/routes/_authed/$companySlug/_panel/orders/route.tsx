import { Outlet, createFileRoute } from "@tanstack/react-router";

import { validateOrdersSearch } from "../../../../../features/orders/api/orders-list-search";
import {
  OrdersListCompanySubtitle,
  OrdersListHeaderTrailing,
  OrdersListPage,
} from "../../../../../features/orders/list/orders-list-page";
import { useRequiredPanelState } from "../../../../../layouts/panel/panel-route-state";
import { SectionWorkspace } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/orders")({
  validateSearch: validateOrdersSearch,
  staticData: {
    panel: {
      panelSection: "orders",
      pane: "list",
      listTo: "/$companySlug/orders",
    },
  },
  component: OrdersWorkspaceLayout,
});

function OrdersWorkspaceLayout() {
  const panel = useRequiredPanelState();
  return (
    <SectionWorkspace
      section={panel.panelSection}
      pane={panel.pane}
      headerSubtitle={<OrdersListCompanySubtitle />}
      headerTrailing={<OrdersListHeaderTrailing />}
      listContent={<OrdersListPage />}
    >
      <Outlet />
    </SectionWorkspace>
  );
}
