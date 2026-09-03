/**
 * Live-turn orders list / entity cards from current `UIMessage` parts
 * (SHO-369). Parse façade part names, not persisted `toolRuns.actionName`.
 * Do not walk `items[].orderId` into N `orders.get` cards.
 */
import { formatMoneyMinor } from "../../../format/money";
import { assistantCopy } from "../../../i18n/assistant";
import type { Locale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../../orders/shared/item-count";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  isOrderLifecycleStatus as isOrderStatus,
  ORDER_LIFECYCLE_STATUSES as ORDER_STATUSES,
  orderStatusTone,
  type OrderLifecycleStatus,
  type OrderStatusTone,
} from "../../orders/shared/order-status";
import { confirmationFromChatPart } from "./confirmation";
import {
  isToolErrorOutput,
  type AssistantChatPart,
} from "./confirmation-presenter";
import { toolNameFromPart } from "./turn-timeline";

export { isOrderStatus, ORDER_STATUSES };

/** Named façade page size (SHO-360). Do not import `@showzy/ai`. */
export const ASSISTANT_ORDERS_LIST_ROW_MAX = 9;

export const ASSISTANT_ORDERS_LIST_HREF = "/orders";

const ORDERS_LIST_PAGE_TOOL = "orders_list_page";
const ORDERS_LIST_COUNTS_TOOL = "orders_list_counts";
const ORDERS_GET_TOOLS = new Set(["orders_get", "orders.get"]);
const ORDERS_CREATE_TOOLS = new Set(["orders_create", "orders.create"]);
const UNLINKED_CUSTOMER_NAME_SNAPSHOT = "unlinked";

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

export type AssistantOrderEntityCardView = {
  readonly kind: "order-entity";
  readonly id: string;
  readonly orderId: string;
  readonly href: string;
  readonly orderNumberLabel: string;
  readonly customerName: string | null;
  readonly statusLabel: string | null;
  readonly statusTone: OrderStatusTone;
  readonly totalLabel: string | null;
};

export type AssistantResultCards = {
  readonly listCard: AssistantOrdersListCardView | null;
  readonly entityCards: readonly AssistantOrderEntityCardView[];
};

const EMPTY_RESULT_CARDS: AssistantResultCards = {
  listCard: null,
  entityCards: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClippedOutput(value: unknown): value is {
  readonly status: "clipped";
  readonly preview: unknown;
  readonly omitted: unknown;
} {
  return isRecord(value) && value["status"] === "clipped";
}

function unwrapToolOutput(output: unknown): {
  readonly payload: unknown;
  readonly clipped: boolean;
} {
  if (isClippedOutput(output)) {
    return { payload: output.preview, clipped: true };
  }
  return { payload: output, clipped: false };
}

function isSuccessfulToolOutput(output: unknown): boolean {
  if (output === undefined) {
    return false;
  }
  if (isToolErrorOutput(output)) {
    return false;
  }
  if (confirmationFromChatPart(output) !== undefined) {
    return false;
  }
  return true;
}

function lastSuccessfulPart(
  parts: readonly AssistantChatPart[],
  matches: (toolName: string) => boolean,
): AssistantChatPart | null {
  let found: AssistantChatPart | null = null;
  for (const part of parts) {
    const toolName = toolNameFromPart(part);
    if (toolName === null || !matches(toolName)) {
      continue;
    }
    if (part.state !== "output-available") {
      continue;
    }
    if (!isSuccessfulToolOutput(part.output)) {
      continue;
    }
    found = part;
  }
  return found;
}

function formatTotal(minor: unknown, currency: unknown): string | null {
  if (typeof minor !== "string" || typeof currency !== "string") {
    return null;
  }
  if (currency.length !== 3) {
    return null;
  }
  try {
    return formatMoneyMinor(minor, currency);
  } catch {
    return null;
  }
}

function formatCreatedAt(iso: unknown): string {
  if (typeof iso !== "string" || iso.length === 0) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

function localizeCustomerName(
  nameSnapshot: string,
  missingCustomer: string,
): string {
  if (nameSnapshot === UNLINKED_CUSTOMER_NAME_SNAPSHOT) {
    return missingCustomer;
  }
  return nameSnapshot;
}

function customerNameFromPayload(
  payload: Record<string, unknown>,
  missingCustomer: string,
): string | null {
  const customer = payload["customer"];
  if (!isRecord(customer)) {
    return null;
  }
  const nameSnapshot = customer["nameSnapshot"];
  if (typeof nameSnapshot !== "string" || nameSnapshot.length === 0) {
    return missingCustomer;
  }
  return localizeCustomerName(nameSnapshot, missingCustomer);
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
  const created = formatCreatedAt(row["createdAt"]);
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

function parseEntityCard(
  part: AssistantChatPart,
  orders: ReturnType<typeof ordersCopy>,
): AssistantOrderEntityCardView | null {
  const callId = part.toolCallId;
  const id =
    typeof callId === "string" && callId.length > 0 ? callId : "order-entity";
  const { payload } = unwrapToolOutput(part.output);
  if (!isRecord(payload)) {
    return null;
  }
  const orderId = payload["orderId"];
  if (typeof orderId !== "string" || orderId.length === 0) {
    return null;
  }
  const orderNumber =
    typeof payload["orderNumber"] === "string" ? payload["orderNumber"] : "";
  const status = isOrderStatus(payload["status"]) ? payload["status"] : null;
  return {
    kind: "order-entity",
    id,
    orderId,
    href: orderDetailHref(orderId),
    orderNumberLabel: orderNumber.length > 0 ? `#${orderNumber}` : "",
    customerName: customerNameFromPayload(payload, orders.missingCustomer),
    statusLabel: status !== null ? orders.statuses[status] : null,
    statusTone: status !== null ? orderStatusTone(status) : "action",
    totalLabel: formatTotal(payload["totalGrossMinor"], payload["currency"]),
  };
}

/**
 * One list card when a live `orders_list_page` result is present (chips
 * from same-turn `orders_list_counts`). Counts-only waits for T3.
 * Entity cards from live `orders.get` / `orders.create` only.
 */
export function assistantResultCardsFromParts(
  parts: readonly AssistantChatPart[],
  locale: Locale,
): AssistantResultCards {
  const assistant = assistantCopy(locale);
  const orders = ordersCopy(locale);
  const pagePart = lastSuccessfulPart(
    parts,
    (name) => name === ORDERS_LIST_PAGE_TOOL,
  );
  const countsPart = lastSuccessfulPart(
    parts,
    (name) => name === ORDERS_LIST_COUNTS_TOOL,
  );

  let listCard: AssistantOrdersListCardView | null = null;
  if (pagePart !== null) {
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
    listCard = {
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

  const entityCards: AssistantOrderEntityCardView[] = [];
  for (const part of parts) {
    const toolName = toolNameFromPart(part);
    if (toolName === null) {
      continue;
    }
    if (!ORDERS_GET_TOOLS.has(toolName) && !ORDERS_CREATE_TOOLS.has(toolName)) {
      continue;
    }
    if (part.state !== "output-available") {
      continue;
    }
    if (!isSuccessfulToolOutput(part.output)) {
      continue;
    }
    const entity = parseEntityCard(part, orders);
    if (entity !== null) {
      entityCards.push(entity);
    }
  }

  if (listCard === null && entityCards.length === 0) {
    return EMPTY_RESULT_CARDS;
  }
  return { listCard, entityCards };
}
