import {
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "@showzy/validation/customers";

export { LIST_CUSTOMERS_SEARCH_MAX, LIST_GROUPS_SEARCH_MAX };

/**
 * Page size for drained lookups (group chips, price-list names). Matches
 * the contract max on `customers.listGroups` / `pricing.listPriceLists`.
 */
export const CUSTOMERS_LOOKUP_PAGE_SIZE = 50;
