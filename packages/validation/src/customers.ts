/**
 * Client-safe CRM caps (SHO-179 / SHO-180 / SHO-181 / SHO-194 / features
 * SHO-169 and SHO-191). Module contracts re-export list search the way
 * `catalog.listProducts` re-exports `LIST_PRODUCTS_QUERY_MAX_LENGTH`.
 * Form caps match `customer-view.contract.ts` / `group-view.contract.ts`
 * so mobile can import the same numbers without the module contract.
 */
export const LIST_CUSTOMERS_SEARCH_MAX = 100;
export const LIST_GROUPS_SEARCH_MAX = 100;
export const LIST_COUNTERPARTIES_SEARCH_MAX = 100;

export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_PHONE_MAX = 30;
export const CUSTOMER_EMAIL_MAX = 200;
export const CUSTOMER_NOTES_MAX = 2000;

/** Same 120/2000 caps as `group-view.contract.ts` (SHO-169 / SHO-181). */
export const GROUP_NAME_MAX = 120;
export const GROUP_DESCRIPTION_MAX = 2000;

/**
 * Legal-face caps from feature SHO-191 / `counterparty-view.contract.ts`.
 * Name is 300 (not CRM 120). Mobile imports these without the module
 * contract (SHO-196).
 */
export const COUNTERPARTY_NAME_MAX = 300;
export const COUNTERPARTY_EDRPOU_MAX = 10;
export const COUNTERPARTY_LEGAL_ADDRESS_MAX = 500;
export const COUNTERPARTY_IBAN_MAX = 34;
export const COUNTERPARTY_BANK_NAME_MAX = 200;
export const COUNTERPARTY_BANK_MFO_MAX = 6;
export const COUNTERPARTY_PHONE_MAX = 30;
export const COUNTERPARTY_EMAIL_MAX = 200;
export const COUNTERPARTY_NOTES_MAX = 2000;
