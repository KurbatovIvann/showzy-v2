/**
 * Shared document query-key prefixes for post-write invalidation
 * (SHO-237). Cancel refetches get and the list pages for this tenant.
 */
import { companyQueryScope } from "../../../api/query-options";
import { GET_DOCUMENT_ACTION } from "./document-detail-query";
import { LIST_DOCUMENTS_ACTION } from "./document.queries";

export function documentsListCacheKey(
  companyId: string,
): readonly [string, string] {
  return [LIST_DOCUMENTS_ACTION, companyQueryScope(companyId)];
}

export function documentDetailCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_DOCUMENT_ACTION, companyQueryScope(companyId)];
}

export function documentsWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  return [documentDetailCacheKey(companyId), documentsListCacheKey(companyId)];
}
