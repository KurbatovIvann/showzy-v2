/**
 * Create-form ceilings copied from `orders.create`
 * (`CREATE_ORDER_MAX_ITEMS` / `CREATE_ORDER_COMMENT_MAX` in
 * `packages/modules/orders/src/actions/create.contract.ts`). Mobile
 * cannot import module contracts; keep these in lockstep.
 */
export const CREATE_ORDER_MAX_ITEMS = 100;

/**
 * `LIST_ORDERS_QUERY_MAX` on `orders.list` (SHO-240). Same 100 cap as
 * catalog/customers list search. There is no `@showzy/validation/orders`
 * export — pin the contract number here.
 */
export const LIST_ORDERS_QUERY_MAX = 100;

export const CREATE_ORDER_COMMENT_MAX = 2000;

/** Page size for drained customer/product pickers (contract list max). */
export const ORDER_LOOKUP_PAGE_SIZE = 50;

/** `quantityMilli` scale 3: `1000` = 1 unit. */
export const QUANTITY_MILLI_PER_UNIT = 1000n;

export const DEFAULT_LINE_QUANTITY_MILLI = "1000";

/**
 * Whole-unit stepper ceiling (SHO-305). `quantityMilli` stays a
 * canonical positive integer whose unit conversion fits JS number.
 * 999_999_999 units → 12-digit milli, matching the archived create
 * wire `^[1-9][0-9]{0,11}$` length.
 */
export const MAX_LINE_QUANTITY_UNITS = 999_999_999;

/** Canvas comment textarea — Class B via TextField multiline. */
export const ORDER_COMMENT_LINES = 4;
