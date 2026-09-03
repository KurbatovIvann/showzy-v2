/**
 * URL search for the orders list (q + single-select status chip).
 * Routes import this from feature `api/` (layer rule). Усі omits
 * `status` — never `all` / `active` / `completed`.
 */
import {
  isOrderLifecycleStatus,
  type OrderLifecycleStatus,
} from "../shared/order-status";

/** Matches `orders.list` `filter.query` max after trim. */
export const LIST_ORDERS_QUERY_MAX = 100;

export type OrdersListSearch = {
  readonly q?: string;
  readonly status?: OrderLifecycleStatus;
};

export function validateOrdersSearch(
  search: Record<string, unknown>,
): OrdersListSearch {
  const qRaw = search.q;
  const q =
    typeof qRaw === "string" ? qRaw.slice(0, LIST_ORDERS_QUERY_MAX) : "";
  const status = isOrderLifecycleStatus(search.status)
    ? search.status
    : undefined;
  return {
    ...(q.length > 0 ? { q } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function normalizeOrdersSearch(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, LIST_ORDERS_QUERY_MAX);
}

export type ListOrdersPageInput = {
  readonly kind: "page.summary";
  readonly filter?: {
    readonly statuses?: OrderLifecycleStatus[];
    readonly query?: string;
  };
};

/**
 * Canvas chips are single-select including Усі. Усі omits
 * `filter.statuses` (never send `all`).
 */
export function listOrdersPageInput(
  status: OrderLifecycleStatus | undefined,
  search: string | undefined,
): ListOrdersPageInput {
  const filter =
    status === undefined && search === undefined
      ? undefined
      : {
          ...(status === undefined ? {} : { statuses: [status] }),
          ...(search === undefined ? {} : { query: search }),
        };
  return {
    kind: "page.summary",
    ...(filter === undefined ? {} : { filter }),
  };
}
