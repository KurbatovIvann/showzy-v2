/**
 * Orders aggregate result surface (SHO-370 / SHO-385). Binds
 * `orders_list_counts`. Compose skips this kind when a list page is on
 * the same turn. Do not import `@showzy/ai`.
 */
import { assistantCopy } from "../../../i18n/assistant";
import { interpolate, type Locale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { countPluralForm } from "../../../i18n/plural";
import { itemCountLabel } from "../../orders/shared/item-count";
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
import { ORDERS_LIST_COUNTS_TOOL } from "./orders-list";

export const ORDERS_AGGREGATE_SURFACE_TOOLS = [
  ORDERS_LIST_COUNTS_TOOL,
] as const;

export const ORDERS_AGGREGATE_PROMPT_LINE =
  "After orders_list_counts with no page on the same turn, the UI already shows the orders aggregate card. Reply with a short product-language summary of the totals. Do not dump a markdown table of buckets.";

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
  readonly orderCountLabel: string;
  readonly moneyLabels: readonly string[];
  readonly buckets: readonly AssistantOrdersAggregateBucketView[];
  readonly emptyTitle: string | null;
  readonly emptyDescription: string | null;
  readonly footnotes: readonly string[];
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

function parseNoneBuckets(
  buckets: readonly unknown[],
  noneLabel: string,
): AssistantOrdersAggregateBucketView[] {
  const rows: AssistantOrdersAggregateBucketView[] = [];
  for (const [index, bucket] of buckets.entries()) {
    if (!isRecord(bucket)) {
      continue;
    }
    const identity = bucket["identity"];
    if (!isRecord(identity) || identity["kind"] !== "none") {
      continue;
    }
    const count =
      typeof bucket["orderCount"] === "number" ? bucket["orderCount"] : 0;
    rows.push({
      id: `none:${String(index)}`,
      label: noneLabel,
      orderCountLabel: String(count),
      moneyLabels: grossLabels(bucket["grossByCurrency"]),
      quantityLabel: null,
      status: null,
      statusTone: null,
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

function parseAggregateBuckets(
  groupBy: AssistantOrdersAggregateGroupBy,
  buckets: readonly unknown[],
  orders: ReturnType<typeof ordersCopy>,
  noneLabel: string,
): readonly AssistantOrdersAggregateBucketView[] {
  switch (groupBy) {
    case "status":
      return parseStatusBuckets(buckets, orders);
    case "none":
      return parseNoneBuckets(buckets, noneLabel);
    case "product":
      return parseProductBuckets(buckets);
    case "customer":
      return parseCustomerBuckets(buckets, orders.missingCustomer);
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
  const groupBy = inferAggregateGroupBy(buckets);
  const parsedBuckets = parseAggregateBuckets(
    groupBy,
    buckets,
    orders,
    assistant.cards.noneBucket,
  );
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
  const empty = parsedBuckets.length === 0;
  return {
    kind: "orders-aggregate",
    groupBy,
    orderCountLabel: orderCountLabel(
      orderCount,
      locale,
      assistant.cards.orderCount,
    ),
    moneyLabels: grossLabels(payload["grossByCurrency"]),
    buckets: parsedBuckets,
    emptyTitle: empty ? assistant.cards.aggregateEmptyTitle : null,
    emptyDescription: empty ? assistant.cards.aggregateEmptyDescription : null,
    footnotes,
  };
}
