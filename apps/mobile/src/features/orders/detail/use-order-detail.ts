/**
 * Order detail facade (SHO-212). Composes get + customer hydrate,
 * confirm/cancel, and the actions-sheet reducer. View stays
 * presentational; no RHF and no XState on this screen.
 */
import { useQuery } from "@tanstack/react-query";
import { useReducer } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { getCustomerNameQueryOptions } from "../api/customer-name-query";
import { resolveCustomerNameHydration } from "../shared/customer-name";
import { canEditOrders, orderDetailActions } from "../shared/order-permissions";
import {
  orderDetailHeaderTitle,
  orderDetailWriteChrome,
  toOrderDetailView,
  type OrderDetailState,
  type OrderDetailViewModel,
} from "./order-detail-model";
import {
  IDLE_DETAIL_SHEETS,
  orderDetailSheetChrome,
  reduceOrderDetailSheets,
} from "./order-detail.reducer";
import { useOrderDetailActions } from "./use-order-detail-actions";
import { useOrderDetailQuery } from "./use-order-detail-query";

export type OrderDetailModel = {
  readonly copy: ReturnType<typeof ordersCopy>;
  readonly state: OrderDetailState;
  readonly order: OrderDetailViewModel | null;
  readonly showConfirm: boolean;
  readonly showActions: boolean;
  readonly cancelEnabled: boolean;
  readonly actionsVisible: boolean;
  readonly writePending: boolean;
  readonly statusBanner: string | null;
  readonly headerTitle: string;
  readonly goBack: () => void;
  readonly retry: () => void;
  readonly openActions: () => void;
  readonly closeActions: () => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
};

export function useOrderDetail(
  idParam: string | string[] | undefined,
): OrderDetailModel {
  const locale = detectLocale();
  const copy = ordersCopy(locale);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canEdit = canEditOrders(membership.role);
  const [sheets, dispatch] = useReducer(
    reduceOrderDetailSheets,
    IDLE_DETAIL_SHEETS,
  );
  const query = useOrderDetailQuery(idParam);
  const customerId = query.order?.customerId ?? null;
  const customerQuery = useQuery(
    getCustomerNameQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      customerId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const customer = resolveCustomerNameHydration({
    customerId,
    name: customerQuery.data?.name,
    status: customerQuery.status,
    notFound:
      customerQuery.isError &&
      describeWireError(customerQuery.error)?.code === "NOT_FOUND",
  });
  const actions = useOrderDetailActions({
    orderId: query.orderId,
    copy: copy.detail,
    dispatch,
  });
  const chrome = orderDetailSheetChrome(sheets);
  const order =
    query.order === null
      ? null
      : toOrderDetailView({
          order: query.order,
          copy,
          customer,
          customerPhone: customerQuery.data?.phone ?? null,
        });
  const actionFlags = orderDetailActions({
    canEdit,
    status: order?.status ?? "canceled",
  });
  const writeChrome = orderDetailWriteChrome({
    stateKind: query.state.kind,
    hasOrder: order !== null,
    actionFlags,
  });

  return {
    copy,
    state: query.state,
    order,
    showConfirm: writeChrome.showConfirm,
    showActions: writeChrome.showActions,
    cancelEnabled: writeChrome.cancelEnabled,
    actionsVisible: chrome.actionsVisible,
    writePending: actions.writePending,
    statusBanner: actions.banner,
    headerTitle:
      query.state.kind === "ready"
        ? orderDetailHeaderTitle({
            customer,
            fallbackTitle: copy.detail.title,
            missingCustomer: copy.missingCustomer,
          })
        : copy.detail.title,
    goBack: actions.goBack,
    retry: query.retry,
    openActions: actions.openActions,
    closeActions: actions.closeActions,
    confirm: actions.confirm,
    cancel: actions.cancel,
  };
}
