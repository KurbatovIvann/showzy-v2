import { Link, getRouteApi } from "@tanstack/react-router";

import { OrdersListView } from "./orders-list-view";
import { useOrdersList } from "./use-orders-list";
import { useOrdersCopy } from "../shared/use-orders-copy";

const ordersRoute = getRouteApi("/_authed/$companySlug/_panel/orders");

export function OrdersListHeaderTrailing() {
  const copy = useOrdersCopy();
  const { companySlug } = ordersRoute.useParams();
  return (
    <Link
      to="/$companySlug/orders/new"
      params={{ companySlug }}
      search={(prev) => prev}
      className="mt-0.5 inline-flex h-10 items-center rounded-full px-3 text-[14px] font-semibold text-action hover:bg-actionSoft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
    >
      {copy.createLabel}
    </Link>
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
