/**
 * Client-safe CRM list caps (SHO-179 / feature SHO-169). Same numbers as
 * `customers.listCustomers` / `customers.listGroups` — mobile cannot
 * import module contracts, so the UI reads them here the way catalog
 * list search reads `@showzy/validation/catalog`.
 */
export const LIST_CUSTOMERS_SEARCH_MAX = 100;
export const LIST_GROUPS_SEARCH_MAX = 100;
