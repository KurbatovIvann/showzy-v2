/**
 * Shared orders query-key prefixes for post-write invalidation.
 * Confirm/start/complete/cancel refetch the get view and the list pages
 * for this tenant.
 */
import { companyQueryScope } from "../../../api/query-options";
import { GET_ORDER_ACTION } from "./get";
import { LIST_ORDERS_ACTION } from "./list";

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
