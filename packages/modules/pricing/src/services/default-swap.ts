import { ConflictError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";

import { postgresUniqueConstraint } from "./postgres-unique.js";
import type { WritableStaffDb } from "./writable.js";

/** Partial unique `(company_id) WHERE is_default = true`. */
export const PRICE_LISTS_COMPANY_DEFAULT_UQ = "price_lists_company_default_uq";

export const DEFAULT_PRICE_LIST_CONFLICT_MESSAGE =
  "Another default price list was set at the same time. Retry.";

/**
 * Unsets the company default (zero defaults allowed). Callers that then
 * insert/update a new default wrap the write with
 * `mapDefaultPriceListUniqueViolation` so a concurrent `23505` on
 * `price_lists_company_default_uq` becomes a typed conflict instead of 500.
 */
export async function unsetCompanyDefaultLists(
  db: WritableStaffDb,
  companyId: string,
): Promise<void> {
  await db
    .update(priceLists)
    .set({ isDefault: false })
    .where(
      and(eq(priceLists.companyId, companyId), eq(priceLists.isDefault, true)),
    );
}

export function mapDefaultPriceListUniqueViolation(error: unknown): unknown {
  const constraint = postgresUniqueConstraint(error);
  if (constraint === PRICE_LISTS_COMPANY_DEFAULT_UQ) {
    return new ConflictError(DEFAULT_PRICE_LIST_CONFLICT_MESSAGE, {
      internalMessage: `${PRICE_LISTS_COMPANY_DEFAULT_UQ} unique violation`,
      cause: error,
    });
  }
  return error;
}
