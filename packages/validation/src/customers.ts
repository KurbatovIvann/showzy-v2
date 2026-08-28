/**
 * Client-safe CRM list caps (SHO-179 / feature SHO-169). Module
 * contracts re-export these the way `catalog.listProducts` re-exports
 * `LIST_PRODUCTS_QUERY_MAX_LENGTH`. Mobile cannot import module
 * contracts, so the UI reads the same numbers here.
 */
export const LIST_CUSTOMERS_SEARCH_MAX = 100;
export const LIST_GROUPS_SEARCH_MAX = 100;
