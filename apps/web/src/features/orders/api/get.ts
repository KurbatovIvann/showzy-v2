/**
 * Company-scoped `orders.get`. The **key** uses `companyId` from
 * React state (`useActiveCompany().activeCompanyId`). The **assert**
 * binds `() => client.getActiveCompany()` so a render-closed id cannot
 * skip isolation while `x-company-id` already moved. Loaders and hooks
 * must share this factory.
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";

export const GET_ORDER_ACTION = "orders.get";

/** Contract `orderId` is a UUID; refuse anything else. */
export const ORDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GetOrderClient = ShowzyClient;
export type GetOrderOutput = Awaited<
  ReturnType<GetOrderClient["client"]["orders"]["get"]>
>;
export type GetOrderItem = GetOrderOutput["items"][number];

export function parseOrderId(value: string): string | null {
  const trimmed = value.trim();
  if (!ORDER_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function ordersGetQueryKey(companyId: string, orderId: string) {
  return contractQueryKey(GET_ORDER_ACTION, companyId, { orderId });
}

export function ordersGetQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly orderId: string;
}) {
  const companyId = args.companyId;
  const parsed = parseOrderId(args.orderId);
  const orderId = parsed ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_ORDER_ACTION,
      companyId,
      input: { orderId },
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () => args.client.client.orders.get({ orderId }),
    }),
    enabled: companyId !== null && parsed !== null,
  };
}
