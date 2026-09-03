import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useParams } from "@tanstack/react-router";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { ordersListQueryOptions } from "../api/list";
import {
  LIST_ORDERS_QUERY_MAX,
  listOrdersPageInput,
  normalizeOrdersSearch,
} from "../api/orders-list-search";
import type { OrderLifecycleStatus } from "../shared/order-status";
import { useOrdersCopy, useOrdersLocale } from "../shared/use-orders-copy";
import {
  classifyOrdersList,
  groupOrderRows,
  toOrderRowView,
} from "./orders-list.presenter";

const ordersRoute = getRouteApi("/_authed/$companySlug/_panel/orders");

export function useOrdersList() {
  const client = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const { companySlug } = ordersRoute.useParams();
  const search = ordersRoute.useSearch();
  const navigate = ordersRoute.useNavigate();
  const copy = useOrdersCopy();
  const locale = useOrdersLocale();
  const params = useParams({ strict: false });
  const selectedOrderId =
    typeof params.orderId === "string" ? params.orderId : undefined;

  const queryText = normalizeOrdersSearch(search.q ?? "");
  const input = listOrdersPageInput(search.status, queryText);
  const query = useQuery(
    ordersListQueryOptions({
      client,
      companyId: activeCompanyId,
      input,
    }),
  );

  const rows = (query.data?.items ?? []).map((item) =>
    toOrderRowView(item, { locale, copy }),
  );
  const state = classifyOrdersList({
    status: query.status,
    rowCount: rows.length,
    hasStatusFilter: search.status !== undefined,
    hasSearch: queryText !== undefined,
  });

  return {
    copy,
    companySlug,
    searchText: search.q ?? "",
    statusChip: search.status,
    state,
    entries: groupOrderRows(rows),
    selectedOrderId,
    onSearchChange(value: string) {
      void navigate({
        search: (prev) => {
          const next = value.slice(0, LIST_ORDERS_QUERY_MAX);
          if (next.length === 0) {
            const rest = { ...prev };
            delete rest.q;
            return rest;
          }
          return { ...prev, q: next };
        },
        replace: true,
      });
    },
    onStatusChipChange(status: OrderLifecycleStatus | undefined) {
      void navigate({
        search: (prev) => {
          if (status === undefined) {
            const rest = { ...prev };
            delete rest.status;
            return rest;
          }
          return { ...prev, status };
        },
        replace: true,
      });
    },
    onRetry() {
      void query.refetch();
    },
    onResetFilters() {
      void navigate({
        search: {},
        replace: true,
      });
    },
  };
}
