/**
 * Orders list result surface (SHO-369 / SHO-385). Binds `orders_list_page`
 * plus same-turn `orders_list_counts` chips. Do not walk `items[].orderId`
 * into entity cards. Do not import `@showzy/ai`.
 */
import { assistantCopy } from "../../../i18n/assistant";
import type { Locale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../../orders/shared/item-count";
import { formatOrderCreatedAt } from "../../orders/shared/order-created-at";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  isOrderLifecycleStatus as isOrderStatus,
  ORDER_LIFECYCLE_STATUSES as ORDER_STATUSES,
  orderStatusTone,
  type OrderLifecycleStatus,
  type OrderStatusTone,
} from "../../orders/shared/order-status";
import type { AssistantChatPart } from "../shared/confirmation-presenter";
import {
  customerNameFromPayload,
  formatTotal,
  isRecord,
  lastSuccessfulPart,
  unwrapToolOutput,
} from "./helpers";

/** Named façade page size (SHO-360). Do not import `@showzy/ai`. */
export const ASSISTANT_ORDERS_LIST_ROW_MAX = 9;

export const ASSISTANT_ORDERS_LIST_HREF = "/orders";

export const ORDERS_LIST_PAGE_TOOL = "orders_list_page";
export const ORDERS_LIST_COUNTS_TOOL = "orders_list_counts";

export const ORDERS_LIST_SURFACE_TOOLS = [
  ORDERS_LIST_PAGE_TOOL,
  ORDERS_LIST_COUNTS_TOOL,
] as const;

export const ORDERS_LIST_PROMPT_LINE =
  "After orders_list_page (chips from same-turn orders_list_counts), the UI already shows the orders list card. Reply with a short product-language summary. Do not dump a markdown table of the rows.";

export type AssistantOrdersListChipView = {
  readonly status: OrderLifecycleStatus;
  readonly label: string;
  readonly tone: OrderStatusTone;
};

export type AssistantOrdersListRowView = {
  readonly orderId: string;
  readonly href: string;
  readonly orderNumberLabel: string;
  readonly customerName: string;
  readonly statusLabel: string | null;
  readonly statusTone: OrderStatusTone;
  readonly metaLabel: string;
  readonly totalLabel: string | null;
};

export type AssistantOrdersListCardView = {
  readonly kind: "orders-list";
  readonly rows: readonly AssistantOrdersListRowView[];
  readonly chips: readonly AssistantOrdersListChipView[];
  readonly emptyTitle: string | null;
  readonly emptyDescription: string | null;
  readonly footnotes: readonly string[];
  readonly ctaLabel: string | null;
  readonly ctaHref: typeof ASSISTANT_ORDERS_LIST_HREF | null;
};

function formatCreatedAt(iso: unknown, locale: Locale): string {
  if (typeof iso !== "string" || iso.length === 0) {
    return "";
  }
  return formatOrderCreatedAt(iso, locale);
}

function joinMeta(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(" · ");
}

function parseListRow(
  row: unknown,
  locale: Locale,
  orders: ReturnType<typeof ordersCopy>,
): AssistantOrdersListRowView | null {
  if (!isRecord(row)) {
    return null;
  }
  const orderId = row["orderId"];
  if (typeof orderId !== "string" || orderId.length === 0) {
    return null;
  }
  const orderNumber =
    typeof row["orderNumber"] === "string" ? row["orderNumber"] : "";
  const status = isOrderStatus(row["status"]) ? row["status"] : null;
  const customerName =
    customerNameFromPayload(row, orders.missingCustomer) ??
    orders.missingCustomer;
  const itemCount = row["itemCount"];
  const itemMeta =
    typeof itemCount === "number"
      ? itemCountLabel(itemCount, locale, orders.items)
      : "";
  const created = formatCreatedAt(row["createdAt"], locale);
  const numberLabel = orderNumber.length > 0 ? `#${orderNumber}` : "";
  return {
    orderId,
    href: orderDetailHref(orderId),
    orderNumberLabel: numberLabel,
    customerName,
    statusLabel: status !== null ? orders.statuses[status] : null,
    statusTone: status !== null ? orderStatusTone(status) : "action",
    metaLabel: joinMeta([numberLabel, itemMeta, created]),
    totalLabel: formatTotal(row["totalGrossMinor"], row["currency"]),
  };
}

function statusChipsFromCounts(
  output: unknown,
  orders: ReturnType<typeof ordersCopy>,
): readonly AssistantOrdersListChipView[] {
  const { payload } = unwrapToolOutput(output);
  if (!isRecord(payload) || payload["kind"] !== "aggregate") {
    return [];
  }
  const buckets = payload["buckets"];
  if (!Array.isArray(buckets)) {
    return [];
  }
  const counts = new Map<OrderLifecycleStatus, number>();
  for (const bucket of buckets) {
    if (!isRecord(bucket)) {
      continue;
    }
    const identity = bucket["identity"];
    if (!isRecord(identity) || identity["kind"] !== "status") {
      continue;
    }
    if (!isOrderStatus(identity["status"])) {
      continue;
    }
    const orderCount = bucket["orderCount"];
    counts.set(
      identity["status"],
      typeof orderCount === "number" ? orderCount : 0,
    );
  }
  const chips: AssistantOrdersListChipView[] = [];
  for (const status of ORDER_STATUSES) {
    const count = counts.get(status);
    if (count === undefined) {
      continue;
    }
    chips.push({
      status,
      label: `${orders.statuses[status]} · ${String(count)}`,
      tone: orderStatusTone(status),
    });
  }
  return chips;
}

function pageItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) {
    return [];
  }
  const items = payload["items"];
  return Array.isArray(items) ? items : [];
}

function pageNextCursor(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  const cursor = payload["nextCursor"];
  return typeof cursor === "string" && cursor.length > 0 ? cursor : null;
}

function pageCustomerMatchTruncated(payload: unknown): boolean {
  return isRecord(payload) && payload["customerMatchTruncated"] === true;
}

/**
 * One list surface when a live `orders_list_page` result is present.
 * Chips come from same-turn `orders_list_counts`. Returns null when there
 * is no successful page — counts-only is the aggregate kind.
 */
export function parseOrdersListSurface(
  parts: readonly AssistantChatPart[],
  locale: Locale,
): AssistantOrdersListCardView | null {
  const assistant = assistantCopy(locale);
  const orders = ordersCopy(locale);
  const pagePart = lastSuccessfulPart(
    parts,
    (name) => name === ORDERS_LIST_PAGE_TOOL,
  );
  if (pagePart === null) {
    return null;
  }
  const countsPart = lastSuccessfulPart(
    parts,
    (name) => name === ORDERS_LIST_COUNTS_TOOL,
  );
  const { payload, clipped } = unwrapToolOutput(pagePart.output);
  const parsedRows: AssistantOrdersListRowView[] = [];
  for (const row of pageItems(payload)) {
    if (parsedRows.length >= ASSISTANT_ORDERS_LIST_ROW_MAX) {
      break;
    }
    const parsed = parseListRow(row, locale, orders);
    if (parsed !== null) {
      parsedRows.push(parsed);
    }
  }
  const nextCursor = pageNextCursor(payload);
  const showCta = clipped || nextCursor !== null;
  const footnotes: string[] = [];
  if (pageCustomerMatchTruncated(payload)) {
    footnotes.push(assistant.cards.customerMatchTruncated);
  }
  if (clipped) {
    footnotes.push(assistant.cards.clipped);
  }
  const empty = parsedRows.length === 0;
  return {
    kind: "orders-list",
    rows: parsedRows,
    chips:
      countsPart === null
        ? []
        : statusChipsFromCounts(countsPart.output, orders),
    emptyTitle: empty ? assistant.cards.listEmptyTitle : null,
    emptyDescription: empty ? assistant.cards.listEmptyDescription : null,
    footnotes,
    ctaLabel: showCta ? assistant.cards.openOrders : null,
    ctaHref: showCta ? ASSISTANT_ORDERS_LIST_HREF : null,
  };
}
