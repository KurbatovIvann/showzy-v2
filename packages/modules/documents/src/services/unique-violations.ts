import { ConcurrentRetryError, ConflictError } from "@showzy/core/errors";
import { postgresUniqueConstraint } from "@showzy/module-kit/postgres-unique";

export const DOCUMENTS_LIVE_ORDER_TYPE_UQ =
  "documents_company_order_type_live_uq";

export const SHARE_ACTIVE_TOKEN_UQ =
  "document_share_tokens_document_id_active_uq";

export const DUPLICATE_LIVE_DOCUMENT_MESSAGE =
  "A live document of this type already exists for the order.";

export function mapLiveDocumentUniqueViolation(error: unknown): unknown {
  if (postgresUniqueConstraint(error) === DOCUMENTS_LIVE_ORDER_TYPE_UQ) {
    return new ConflictError(DUPLICATE_LIVE_DOCUMENT_MESSAGE);
  }
  return error;
}

export function mapShareActiveTokenUniqueViolation(error: unknown): unknown {
  if (postgresUniqueConstraint(error) === SHARE_ACTIVE_TOKEN_UQ) {
    return new ConcurrentRetryError(1);
  }
  return error;
}
