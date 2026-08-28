/**
 * Shared price-list query-key prefixes for post-write invalidation
 * (SHO-189). Customers picker keys use the same action name, so this
 * prefix also refreshes that cache.
 */
import { companyQueryScope } from "../../../api/query-options";
import { LIST_PRICE_LISTS_ACTION } from "./price-list.queries";

export const GET_PRICE_LIST_ACTION = "pricing.getPriceList";

export function priceListsListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_PRICE_LISTS_ACTION, companyQueryScope(companyId)];
}

export function priceListDetailCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_PRICE_LIST_ACTION, companyQueryScope(companyId)];
}

export function priceListsWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  return [
    priceListsListCacheKey(companyId),
    priceListDetailCacheKey(companyId),
  ];
}
