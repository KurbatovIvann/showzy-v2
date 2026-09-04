import { getRouteApi } from "@tanstack/react-router";

import { useOrdersCopy } from "../shared/use-orders-copy";
import { OrdersCreateLink } from "./orders-create-link";
import { OrdersListView } from "./orders-list-view";
import { useOrdersList } from "./use-orders-list";

export { OrdersListCompanySubtitle } from "./orders-list-company-subtitle";

const ordersRoute = getRouteApi("/_authed/$companySlug/_panel/orders");

export function OrdersListHeaderTrailing() {
  const copy = useOrdersCopy();
  const { companySlug } = ordersRoute.useParams();
  const { state } = useOrdersList();
  // Canvas hides the header CTA when the list empty-state has its own.
  if (state.kind === "empty-catalog") {
    return null;
  }
  return (
    <OrdersCreateLink companySlug={companySlug} label={copy.createLabel} />
  );
}

export function OrdersListPage() {
  const model = useOrdersList();
  return (
    <OrdersListView
      copy={model.copy}
      companySlug={model.companySlug}
      searchText={model.searchText}
      statusChip={model.statusChip}
      state={model.state}
      entries={model.entries}
      selectedOrderId={model.selectedOrderId}
      onSearchChange={model.onSearchChange}
      onStatusChipChange={model.onStatusChipChange}
      onRetry={model.onRetry}
      onResetFilters={model.onResetFilters}
    />
  );
}
