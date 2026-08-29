import { ConflictError } from "@showzy/core/errors";

import { postgresUniqueConstraint } from "./postgres-unique.js";

export const DOCUMENTS_LIVE_ORDER_TYPE_UQ =
  "documents_company_order_type_live_uq";

export const DUPLICATE_LIVE_DOCUMENT_MESSAGE =
  "A live document of this type already exists for the order.";

export function mapLiveDocumentUniqueViolation(error: unknown): unknown {
  if (postgresUniqueConstraint(error) === DOCUMENTS_LIVE_ORDER_TYPE_UQ) {
    return new ConflictError(DUPLICATE_LIVE_DOCUMENT_MESSAGE);
  }
  return error;
}
