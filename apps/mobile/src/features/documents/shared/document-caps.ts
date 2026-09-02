/**
 * Lookup ceilings for the document create pickers (SHO-238).
 * `LIST_ORDERS_QUERY_MAX` matches `orders.list` (SHO-240). There is no
 * `@showzy/validation/orders` export — pin the contract number here.
 * Counterparty search max comes from `@showzy/validation/customers`.
 */
import { LIST_COUNTERPARTIES_SEARCH_MAX } from "@showzy/validation/customers";

export { LIST_COUNTERPARTIES_SEARCH_MAX };

export const LIST_ORDERS_QUERY_MAX = 100;

/** Page size for drained order / counterparty pickers (contract list max). */
export const DOCUMENT_LOOKUP_PAGE_SIZE = 50;

/**
 * Create-time «Підстава» max. Matches `documents.createFromOrder` /
 * `DOCUMENT_BASIS_MAX` (SHO-365). There is no `@showzy/validation/documents`
 * export — pin the contract number here.
 */
export const DOCUMENT_BASIS_MAX = 500;

/** Canvas-like textarea rows for the optional delivery-note basis field. */
export const DOCUMENT_BASIS_LINES = 3;
