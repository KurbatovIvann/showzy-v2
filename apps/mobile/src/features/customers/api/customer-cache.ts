/**
 * Shared customers query-key prefixes for post-write invalidation
 * (SHO-179). Signed download URLs are not listed here.
 */
import { companyQueryScope } from "../../../api/query-options";
import { LIST_CUSTOMERS_ACTION } from "./customer.queries";
import { LIST_GROUPS_ACTION } from "./group.queries";

export function customersListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_CUSTOMERS_ACTION, companyQueryScope(companyId)];
}

export function groupsListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_GROUPS_ACTION, companyQueryScope(companyId)];
}

export function customersWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  return [customersListCacheKey(companyId), groupsListCacheKey(companyId)];
}
