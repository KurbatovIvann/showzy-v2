/**
 * Client-safe CRM caps (SHO-179 / SHO-180 / feature SHO-169). Module
 * contracts re-export list search the way `catalog.listProducts`
 * re-exports `LIST_PRODUCTS_QUERY_MAX_LENGTH`. Form caps match
 * `customer-view.contract.ts` so mobile can import the same numbers
 * without the module contract.
 */
export const LIST_CUSTOMERS_SEARCH_MAX = 100;
export const LIST_GROUPS_SEARCH_MAX = 100;

export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_PHONE_MAX = 30;
export const CUSTOMER_EMAIL_MAX = 200;
export const CUSTOMER_NOTES_MAX = 2000;
