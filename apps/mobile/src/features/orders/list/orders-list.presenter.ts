/**
 * Pure view-model logic for the orders list (SHO-211). No React Native
 * imports so the whole decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import { interpolate, type Locale } from "../../../i18n/locale";
import type { OrdersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../shared/item-count";
import type {
  ListOrdersPageInput,
  OrderListItem,
  OrdersListStatus,
} from "../api/order.queries";

export type OrderStatusFilter = "new" | "confirmed" | "canceled";

export const ORDER_STATUS_FILTERS: readonly OrderStatusFilter[] = [
  "new",
  "confirmed",
  "canceled",
];

export function flattenOrderPages(
  pages: ReadonlyArray<{ readonly items: readonly OrderListItem[] }>,
): readonly OrderListItem[] {
  return pages.flatMap((page) => page.items);
}

export function sortOrderStatusFilters(
  selected: readonly OrderStatusFilter[],
): readonly OrderStatusFilter[] {
  return ORDER_STATUS_FILTERS.filter((status) => selected.includes(status));
}

export function toggleOrderStatusFilter(
  selected: readonly OrderStatusFilter[],
  status: OrderStatusFilter,
): readonly OrderStatusFilter[] {
  const next = selected.includes(status)
    ? selected.filter((item) => item !== status)
    : [...selected, status];
  return sortOrderStatusFilters(next);
}

/**
 * Empty selected statuses = `all`. A single selected status is sent to
 * the server. Two or three selected statuses fetch `all` and the
 * presenter filters the page client-side (the list action takes one
 * status).
 */
export function listOrdersStatusParam(
  selected: readonly OrderStatusFilter[],
): OrdersListStatus {
  if (selected.length === 1) {
    const only = selected[0];
    if (only !== undefined) {
      return only;
    }
  }
  return "all";
}

export function listOrdersPageInput(
  selected: readonly OrderStatusFilter[],
): ListOrdersPageInput {
  return { status: listOrdersStatusParam(selected) };
}

export function filterOrdersBySelectedStatuses<
  T extends { readonly status: OrderStatusFilter },
>(items: readonly T[], selected: readonly OrderStatusFilter[]): readonly T[] {
  if (selected.length === 0) {
    return items;
  }
  const allowed = new Set(selected);
  return items.filter((item) => allowed.has(item.status));
}

export function hasActiveStatusFilter(
  selected: readonly OrderStatusFilter[],
): boolean {
  return selected.length > 0;
}

/**
 * Two or more chips fetch `status: "all"` and narrow client-side. Keep
 * requesting pages while the loaded window has no matches — otherwise
 * `classifyOrdersList` would treat an incomplete window as filtered-empty
 * and hide FlashList before later matching rows can load.
 */
export function shouldPageThroughClientStatusFilter(args: {
  readonly selectedCount: number;
  readonly matchingRowCount: number;
  readonly status: "pending" | "error" | "success";
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
}): boolean {
  return (
    args.selectedCount >= 2 &&
    args.matchingRowCount === 0 &&
    args.status === "success" &&
    args.hasNextPage &&
    !args.isFetchingNextPage
  );
}

const UK_MONTHS = [
  "січ.",
  "лют.",
  "бер.",
  "квіт.",
  "трав.",
  "черв.",
  "лип.",
  "серп.",
  "вер.",
  "жовт.",
  "лист.",
  "груд.",
] as const;

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Canvas `d MMM yyyy` without adding date-fns. Local calendar date. */
export function formatOrderCreatedAt(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const months = locale === "uk" ? UK_MONTHS : EN_MONTHS;
  const monthLabel = months[month];
  if (monthLabel === undefined) {
    return "";
  }
  return `${String(day)} ${monthLabel} ${String(year)}`;
}

export function customerNameLabel(
  args: {
    readonly name: string | undefined;
  },
  fallback: string,
): string {
  const name = args.name?.trim();
  if (name !== undefined && name.length > 0) {
    return name;
  }
  return fallback;
}

export type OrderStatusTone = "action" | "danger";

export function orderStatusTone(status: OrderStatusFilter): OrderStatusTone {
  return status === "canceled" ? "danger" : "action";
}

export type OrderRowView = {
  readonly id: string;
  readonly customerName: string;
  readonly status: OrderStatusFilter;
  readonly statusLabel: string;
  readonly statusTone: OrderStatusTone;
  readonly metaLabel: string;
  readonly totalLabel: string;
};

export function toOrderRowView(
  item: OrderListItem,
  args: {
    readonly locale: Locale;
    readonly copy: OrdersCopy;
    readonly customerName: string | undefined;
  },
): OrderRowView {
  return {
    id: item.orderId,
    customerName: customerNameLabel(
      { name: args.customerName },
      args.copy.missingCustomer,
    ),
    status: item.status,
    statusLabel: args.copy.statuses[item.status],
    statusTone: orderStatusTone(item.status),
    metaLabel: `${itemCountLabel(item.itemCount, args.locale, args.copy.items)} · ${formatOrderCreatedAt(item.createdAt, args.locale)}`,
    totalLabel: formatMoneyMinor(item.totalGrossMinor, item.currency),
  };
}

export type OrderGroupKey = "inProgress" | "completed";

export type OrdersListEntry =
  | {
      readonly type: "header";
      readonly key: OrderGroupKey;
      readonly count: number;
    }
  | { readonly type: "row"; readonly order: OrderRowView };

export function isInProgressStatus(status: OrderStatusFilter): boolean {
  return status === "new" || status === "confirmed";
}

export function groupOrderRows(
  rows: readonly OrderRowView[],
): readonly OrdersListEntry[] {
  const inProgress = rows.filter((row) => isInProgressStatus(row.status));
  const completed = rows.filter((row) => row.status === "canceled");
  const entries: OrdersListEntry[] = [];
  if (inProgress.length > 0) {
    entries.push({
      type: "header",
      key: "inProgress",
      count: inProgress.length,
    });
    for (const order of inProgress) {
      entries.push({ type: "row", order });
    }
  }
  if (completed.length > 0) {
    entries.push({
      type: "header",
      key: "completed",
      count: completed.length,
    });
    for (const order of completed) {
      entries.push({ type: "row", order });
    }
  }
  return entries;
}

export function orderGroupHeaderLabel(
  key: OrderGroupKey,
  count: number,
  copy: OrdersCopy,
): string {
  return interpolate(copy.groupCount, {
    title: copy.groups[key],
    count: String(count),
  });
}

export function stickyHeaderIndices(
  entries: readonly OrdersListEntry[],
): number[] {
  const indices: number[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index]?.type === "header") {
      indices.push(index);
    }
  }
  return indices;
}

export type OrdersListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-filtered" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "rows" };

/**
 * Canvas state machine minus search: skeletons while loading, offline
 * vs error, then filtered-empty vs catalog-empty. No probe query — an
 * unfiltered empty page is "no orders yet". A status filter with no
 * matches on the loaded pages is not terminal while more pages exist
 * (or a next page is in flight): keep list chrome so pagination works.
 */
export function classifyOrdersList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly hasStatusFilter: boolean;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
}): OrdersListState {
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    return args.failureKind === "offline"
      ? { kind: "offline" }
      : { kind: "error" };
  }
  if (args.rowCount > 0) {
    return { kind: "rows" };
  }
  if (args.hasStatusFilter && (args.hasNextPage || args.isFetchingNextPage)) {
    return { kind: "rows" };
  }
  return args.hasStatusFilter
    ? { kind: "empty-filtered" }
    : { kind: "empty-catalog" };
}
