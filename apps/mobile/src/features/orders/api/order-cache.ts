/**
 * Shared orders query-key prefixes for post-write invalidation (SHO-212).
 * Confirm/cancel refetch the get view and the list pages for this tenant.
 */
import { companyQueryScope } from "../../../api/query-options";
import { GET_ORDER_ACTION } from "./order-detail-query";
import { LIST_ORDERS_ACTION } from "./order.queries";

export function ordersListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_ORDERS_ACTION, companyQueryScope(companyId)];
}

export function orderDetailCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_ORDER_ACTION, companyQueryScope(companyId)];
}

export function ordersWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  return [orderDetailCacheKey(companyId), ordersListCacheKey(companyId)];
}
