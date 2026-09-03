/**
 * Create-form ceilings copied from `orders.create`
 * (`CREATE_ORDER_MAX_ITEMS` / `CREATE_ORDER_COMMENT_MAX`). Web cannot
 * import module contracts; keep these in lockstep.
 */
export const CREATE_ORDER_MAX_ITEMS = 100;

export const CREATE_ORDER_COMMENT_MAX = 2000;

/** Page size for customer/product pickers (contract list max). */
export const ORDER_LOOKUP_PAGE_SIZE = 50;

/**
 * Trailing-edge debounce before picker typeahead hits
 * `customers.listCustomers.search` / `catalog.listProducts.query`.
 */
export const ORDER_LOOKUP_SEARCH_DEBOUNCE_MS = 300;

export { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";
export { LIST_PRODUCTS_QUERY_MAX } from "@showzy/validation/catalog";

/** Empty and whitespace-only searches omit the contract field. */
export function normalizeOrderLookupSearch(
  text: string,
  maxLength: number,
): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

/** `quantityMilli` scale 3: `1000` = 1 unit. */
export const QUANTITY_MILLI_PER_UNIT = 1000n;

export const DEFAULT_LINE_QUANTITY_MILLI = "1000";

/**
 * Whole-unit stepper ceiling. `quantityMilli` stays a canonical
 * positive integer whose unit conversion fits JS number.
 */
export const MAX_LINE_QUANTITY_UNITS = 999_999_999;

export const ORDER_COMMENT_LINES = 4;
