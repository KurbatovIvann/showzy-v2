/**
 * Shared catalog query-key prefixes for post-write invalidation (SHO-157).
 * Form, photos, and detail tickets import these instead of assembling
 * action names themselves. Signed download URLs are not listed here.
 */
import { companyQueryScope } from "../../../../api/query-options";
import { GET_PRODUCT_ACTION } from "./product-detail-query";
import { LIST_PRODUCTS_ACTION } from "./product.queries";

export function catalogProductCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_PRODUCT_ACTION, companyQueryScope(companyId)];
}

export function catalogListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_PRODUCTS_ACTION, companyQueryScope(companyId)];
}

export function catalogWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  return [catalogProductCacheKey(companyId), catalogListCacheKey(companyId)];
}
