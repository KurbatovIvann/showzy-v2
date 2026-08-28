/**
 * Caps that match `pricing.listPriceLists` (SHO-184). There is no
 * `@showzy/validation/pricing` export yet — pin the contract numbers
 * here instead of a second local literal in the presenter.
 */
export const LIST_PRICE_LISTS_QUERY_MAX = 100;

/** Canvas dashed hint after fewer than four lists. */
export const PRICE_LISTS_HINT_MAX = 4;
