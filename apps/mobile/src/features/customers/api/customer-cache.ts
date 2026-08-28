/**
 * Shared customers query-key prefixes for post-write invalidation
 * (SHO-179 / SHO-195). Signed download URLs are not listed here.
 */
import { companyQueryScope } from "../../../api/query-options";
import { LIST_COUNTERPARTIES_ACTION } from "./counterparty.queries";
import { GET_CUSTOMER_ACTION } from "./customer-detail-query";
import { LIST_CUSTOMERS_ACTION } from "./customer.queries";
import { GET_GROUP_ACTION } from "./group-detail-query";
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

export function counterpartiesListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_COUNTERPARTIES_ACTION, companyQueryScope(companyId)];
}

export function customerDetailCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_CUSTOMER_ACTION, companyQueryScope(companyId)];
}

export function groupDetailCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_GROUP_ACTION, companyQueryScope(companyId)];
}

export function customersWriteInvalidationKeys(
  companyId: string,
): readonly [
  readonly [string, string],
  readonly [string, string],
  readonly [string, string],
  readonly [string, string],
  readonly [string, string],
] {
  return [
    customersListCacheKey(companyId),
    groupsListCacheKey(companyId),
    counterpartiesListCacheKey(companyId),
    customerDetailCacheKey(companyId),
    groupDetailCacheKey(companyId),
  ];
}
