import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "@showzy/validation/customers";

export {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
};

/**
 * Page size for drained lookups (group chips, price-list names). Matches
 * the contract max on `customers.listGroups` / `pricing.listPriceLists`.
 */
export const CUSTOMERS_LOOKUP_PAGE_SIZE = 50;

/** Canvas notes textarea `rows={5}` — Class B via TextField multiline. */
export const CUSTOMER_FORM_NOTES_LINES = 5;

/** Canvas GroupEditor description `rows={4}` — Class B via TextField. */
export const GROUP_FORM_DESCRIPTION_LINES = 4;
