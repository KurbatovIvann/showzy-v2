import { ConflictError } from "@showzy/core/errors";

import { postgresUniqueConstraint } from "./postgres-unique.js";

export const ORDERS_COMPANY_ORDER_NUMBER_UQ =
  "orders_company_id_order_number_uq";

export function mapOrderNumberUniqueViolation(error: unknown): unknown {
  if (postgresUniqueConstraint(error) === ORDERS_COMPANY_ORDER_NUMBER_UQ) {
    return new ConflictError("Order number already assigned.");
  }
  return error;
}
