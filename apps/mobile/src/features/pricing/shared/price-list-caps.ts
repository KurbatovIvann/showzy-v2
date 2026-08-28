/**
 * Caps that match pricing contracts (SHO-184 / SHO-185 / SHO-190).
 * There is no `@showzy/validation/pricing` export yet — pin the
 * contract numbers here instead of a second local literal.
 */
export const LIST_PRICE_LISTS_QUERY_MAX = 100;

/** Canvas dashed hint after fewer than four lists. */
export const PRICE_LISTS_HINT_MAX = 4;

/** `PRICE_LIST_NAME_MAX` on `pricing.createPriceList` / update. */
export const PRICE_LIST_NAME_MAX = 120;

/** `SET_PRICE_LIST_ENTRIES_MAX_ITEMS` / remove batch ceiling. */
export const SET_PRICE_LIST_ENTRIES_MAX_ITEMS = 200;

export const REMOVE_PRICE_LIST_ENTRIES_MAX_ITEMS =
  SET_PRICE_LIST_ENTRIES_MAX_ITEMS;

/** UAH-only (db.md §11); same pin as catalog product forms. */
export const PRICE_LIST_CURRENCY = "UAH";

/** `LIST_PRODUCTS_MAX_LIMIT` / `LIST_PRICE_LIST_ENTRIES_MAX_LIMIT`. */
export const PRICE_LIST_EDITOR_PAGE_LIMIT = 50;
