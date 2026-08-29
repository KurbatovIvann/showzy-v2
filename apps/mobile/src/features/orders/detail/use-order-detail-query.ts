/**
 * `orders.get` only (SHO-212). Customer name hydrates separately via
 * `customers.getCustomer` so this module does not import
 * `features/customers`.
 */
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../../api/api-provider";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import {
  getOrderQueryOptions,
  type GetOrderOutput,
} from "../api/order-detail-query";
import { classifyOrderDetail } from "../shared/classify-order-load";
import { orderIdFromParam } from "../shared/order-id";
import type { OrderDetailState } from "./order-detail-model";

export function useOrderDetailQuery(idParam: string | string[] | undefined): {
  readonly orderId: string | null;
  readonly state: OrderDetailState;
  readonly order: GetOrderOutput | null;
  readonly retry: () => void;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const orderId = orderIdFromParam(idParam);
  const query = useQuery(
    getOrderQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      orderId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const failureKind = query.isError
    ? describeQueryFailure(query.error).kind
    : null;

  return {
    orderId,
    state: classifyOrderDetail({
      orderId,
      clientReady: apiClient !== null && activeCompanyId !== null,
      status: query.status,
      failureKind,
    }),
    order: query.data === undefined ? null : query.data,
    retry: () => {
      void query.refetch();
    },
  };
}
