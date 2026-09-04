/**
 * Orders aggregate result surface (SHO-370 / SHO-385 / SHO-395). Binds
 * `orders_list_counts`. Compose skips this kind when a list page is on
 * the same turn. Do not import `@showzy/ai`.
 */
import { assistantCopy } from "../../../i18n/assistant";
import { interpolate, type Locale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { countPluralForm } from "../../../i18n/plural";
import { itemCountLabel } from "../../orders/shared/item-count";
import { formatOrderCreatedAt } from "../../orders/shared/order-created-at";
import {
  isOrderLifecycleStatus as isOrderStatus,
  ORDER_LIFECYCLE_STATUSES as ORDER_STATUSES,
  orderStatusTone,
  type OrderLifecycleStatus,
  type OrderStatusTone,
} from "../../orders/shared/order-status";
import type { AssistantChatPart } from "../shared/confirmation-presenter";
import {
  formatQuantityLabel,
  grossLabels,
  isRecord,
  lastSuccessfulPart,
  localizeCustomerName,
  unwrapToolOutput,
} from "./helpers";
import {
  ASSISTANT_ORDERS_LIST_HREF,
  ORDERS_LIST_COUNTS_TOOL,
} from "./orders-list";

export const ORDERS_AGGREGATE_SURFACE_TOOLS = [
  ORDERS_LIST_COUNTS_TOOL,
] as const;

export const ORDERS_AGGREGATE_PROMPT_LINE =
  "After orders_list_counts with no page on the same turn, the UI already shows the orders aggregate card with period, totals, and a status breakdown. Reply with a short product-language summary of the totals. Do not dump a markdown table of buckets. Do not call orders_list_counts or orders.list again for the card.";

export type AssistantOrdersAggregateGroupBy =
  "none" | "status" | "product" | "customer";

export type AssistantOrdersAggregateBucketView = {
  readonly id: string;
  readonly label: string;
  readonly orderCountLabel: string;
  readonly moneyLabels: readonly string[];
  readonly quantityLabel: string | null;
  readonly status: OrderLifecycleStatus | null;
  readonly statusTone: OrderStatusTone | null;
};

export type AssistantOrdersAggregateCardView = {
  readonly kind: "orders-aggregate";
  readonly groupBy: AssistantOrdersAggregateGroupBy;
  readonly periodLabel: string | null;
  readonly orderCountLabel: string;
  readonly moneyLabels: readonly string[];
  readonly statusBuckets: readonly AssistantOrdersAggregateBucketView[];
  readonly extraBuckets: readonly AssistantOrdersAggregateBucketView[];
  readonly emptyTitle: string | null;
  readonly emptyDescription: string | null;
  readonly footnotes: readonly string[];
  readonly ctaLabel: string;
  readonly ctaHref: typeof ASSISTANT_ORDERS_LIST_HREF;
};

function orderCountLabel(
  count: number,
  locale: Locale,
  forms: ReturnType<typeof assistantCopy>["cards"]["orderCount"],
): string {
  return interpolate(forms[countPluralForm(count, locale)], {
    count: String(count),
  });
}

function isAggregateGroupBy(
  value: unknown,
): value is AssistantOrdersAggregateGroupBy {
  return (
    value === "none" ||
    value === "status" ||
    value === "product" ||
    value === "customer"
  );
}

function inferAggregateGroupBy(
  buckets: readonly unknown[],
): AssistantOrdersAggregateGroupBy {
  for (const bucket of buckets) {
    if (!isRecord(bucket)) {
      continue;
    }
    const identity = bucket["identity"];
    if (!isRecord(identity)) {
      continue;
    }
    if (identity["kind"] === "product") {
      return "product";
    }
    if (identity["kind"] === "customer") {
      return "customer";
    }
    if (identity["kind"] === "status" && isOrderStatus(identity["status"])) {
      return "status";
    }
    if (identity["kind"] === "none") {
      return "none";
    }
  }
  return "status";
}

function parseAggregateGroupBy(
  input: unknown,
  buckets: readonly unknown[],
): AssistantOrdersAggregateGroupBy {
  if (isRecord(input) && isAggregateGroupBy(input["groupBy"])) {
    return input["groupBy"];
  }
  return inferAggregateGroupBy(buckets);
}

function parsePeriodLabel(
  input: unknown,
  locale: Locale,
  cards: ReturnType<typeof assistantCopy>["cards"],
): string | null {
  if (!isRecord(input)) {
    return null;
  }
  const period = input["period"];
  if (period === "today") {
    return cards.periodToday;
  }
  if (period === "this_week") {
    return cards.periodThisWeek;
  }
  if (period === "this_month") {
    return cards.periodThisMonth;
  }
  const fromIso =
    typeof input["createdFrom"] === "string" ? input["createdFrom"] : "";
  const toIso =
    typeof input["createdTo"] === "string" ? input["createdTo"] : "";
  const from = fromIso.length > 0 ? formatOrderCreatedAt(fromIso, locale) : "";
  const to = toIso.length > 0 ? formatOrderCreatedAt(toIso, locale) : "";
  if (from.length > 0 && to.length > 0) {
    return from === to ? from : `${from} – ${to}`;
  }
  if (from.length > 0) {
    return from;
  }
  if (to.length > 0) {
    return to;
  }
  return null;
}

function parseStatusBuckets(
  buckets: readonly unknown[],
  orders: ReturnType<typeof ordersCopy>,
): AssistantOrdersAggregateBucketView[] {
  const byStatus = new Map<OrderLifecycleStatus, unknown>();
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
    byStatus.set(identity["status"], bucket);
  }
  const rows: AssistantOrdersAggregateBucketView[] = [];
  for (const status of ORDER_STATUSES) {
    const bucket = byStatus.get(status);
    if (bucket === undefined || !isRecord(bucket)) {
      continue;
    }
    const count =
      typeof bucket["orderCount"] === "number" ? bucket["orderCount"] : 0;
    rows.push({
      id: status,
      label: orders.statuses[status],
      orderCountLabel: String(count),
      moneyLabels: grossLabels(bucket["grossByCurrency"]),
      quantityLabel: null,
      status,
      statusTone: orderStatusTone(status),
    });
  }
  return rows;
}

function parseProductBuckets(
  buckets: readonly unknown[],
): AssistantOrdersAggregateBucketView[] {
  const rows: AssistantOrdersAggregateBucketView[] = [];
  for (const [index, bucket] of buckets.entries()) {
    if (!isRecord(bucket)) {
      continue;
    }
    const identity = bucket["identity"];
    if (!isRecord(identity) || identity["kind"] !== "product") {
      continue;
    }
    const productId =
      typeof identity["productId"] === "string" ? identity["productId"] : "";
    const variantId =
      typeof identity["variantId"] === "string" ? identity["variantId"] : "";
    const label = typeof bucket["label"] === "string" ? bucket["label"] : "";
    const count =
      typeof bucket["orderCount"] === "number" ? bucket["orderCount"] : 0;
    const id =
      productId.length > 0
        ? `${productId}:${variantId}`
        : `product:${String(index)}`;
    rows.push({
      id,
      label,
      orderCountLabel: String(count),
      moneyLabels: grossLabels(bucket["grossByCurrency"]),
      quantityLabel: formatQuantityLabel(bucket["quantityMilli"]),
      status: null,
      statusTone: null,
    });
  }
  return rows;
}

function parseCustomerBuckets(
  buckets: readonly unknown[],
  missingCustomer: string,
): AssistantOrdersAggregateBucketView[] {
  const rows: AssistantOrdersAggregateBucketView[] = [];
  for (const [index, bucket] of buckets.entries()) {
    if (!isRecord(bucket)) {
      continue;
    }
    const identity = bucket["identity"];
    if (!isRecord(identity) || identity["kind"] !== "customer") {
      continue;
    }
    const customerId =
      typeof identity["customerId"] === "string" ? identity["customerId"] : "";
    const nameSnapshot =
      typeof identity["nameSnapshot"] === "string"
        ? identity["nameSnapshot"]
        : typeof bucket["label"] === "string"
          ? bucket["label"]
          : "";
    const label =
      nameSnapshot.length > 0
        ? localizeCustomerName(nameSnapshot, missingCustomer)
        : missingCustomer;
    const count =
      typeof bucket["orderCount"] === "number" ? bucket["orderCount"] : 0;
    const id = customerId.length > 0 ? customerId : `customer:${String(index)}`;
    rows.push({
      id,
      label,
      orderCountLabel: String(count),
      moneyLabels: grossLabels(bucket["grossByCurrency"]),
      quantityLabel: null,
      status: null,
      statusTone: null,
    });
  }
  return rows;
}

function parseExtraBuckets(
  groupBy: AssistantOrdersAggregateGroupBy,
  buckets: readonly unknown[],
  orders: ReturnType<typeof ordersCopy>,
): readonly AssistantOrdersAggregateBucketView[] {
  switch (groupBy) {
    case "product":
      return parseProductBuckets(buckets);
    case "customer":
      return parseCustomerBuckets(buckets, orders.missingCustomer);
    case "status":
    case "none":
      return [];
  }
}

/**
 * Counts-only aggregate. Compose must not call this when a list page is
 * already on the turn.
 */
export function parseOrdersAggregateSurface(
  parts: readonly AssistantChatPart[],
  locale: Locale,
): AssistantOrdersAggregateCardView | null {
  const assistant = assistantCopy(locale);
  const orders = ordersCopy(locale);
  const countsPart = lastSuccessfulPart(
    parts,
    (name) => name === ORDERS_LIST_COUNTS_TOOL,
  );
  if (countsPart === null) {
    return null;
  }
  const { payload, clipped } = unwrapToolOutput(countsPart.output);
  if (!isRecord(payload) || payload["kind"] !== "aggregate") {
    return null;
  }
  const rawBuckets = payload["buckets"];
  const buckets = Array.isArray(rawBuckets) ? rawBuckets : [];
  const rawStatusBuckets = payload["statusBuckets"];
  const statusSource = Array.isArray(rawStatusBuckets) ? rawStatusBuckets : [];
  const groupBy = parseAggregateGroupBy(countsPart.input, buckets);
  const parsedStatusBuckets = parseStatusBuckets(statusSource, orders);
  const extraBuckets = parseExtraBuckets(groupBy, buckets, orders);
  const orderCount =
    typeof payload["orderCount"] === "number" ? payload["orderCount"] : 0;
  const footnotes: string[] = [];
  if (payload["customerMatchTruncated"] === true) {
    footnotes.push(assistant.cards.customerMatchTruncated);
  }
  if (payload["bucketsTruncated"] === true) {
    footnotes.push(assistant.cards.bucketsTruncated);
  }
  const omitted = payload["bucketsOmitted"];
  if (typeof omitted === "number" && omitted > 0) {
    footnotes.push(
      itemCountLabel(omitted, locale, assistant.cards.bucketsOmitted),
    );
  }
  if (clipped) {
    footnotes.push(assistant.cards.clipped);
  }
  const empty = parsedStatusBuckets.length === 0 && extraBuckets.length === 0;
  return {
    kind: "orders-aggregate",
    groupBy,
    periodLabel: parsePeriodLabel(countsPart.input, locale, assistant.cards),
    orderCountLabel: orderCountLabel(
      orderCount,
      locale,
      assistant.cards.orderCount,
    ),
    moneyLabels: grossLabels(payload["grossByCurrency"]),
    statusBuckets: parsedStatusBuckets,
    extraBuckets,
    emptyTitle: empty ? assistant.cards.aggregateEmptyTitle : null,
    emptyDescription: empty ? assistant.cards.aggregateEmptyDescription : null,
    footnotes,
    ctaLabel: assistant.cards.openOrders,
    ctaHref: ASSISTANT_ORDERS_LIST_HREF,
  };
}
