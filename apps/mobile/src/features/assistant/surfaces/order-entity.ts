/**
 * Order entity result surface (SHO-369 / SHO-385). Binds live
 * `orders.get` / `orders.create` only. Do not walk list `items[].orderId`.
 * Do not import `@showzy/ai`.
 */
import { ordersCopy } from "../../../i18n/orders";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  isOrderLifecycleStatus as isOrderStatus,
  orderStatusTone,
  type OrderStatusTone,
} from "../../orders/shared/order-status";
import type { AssistantChatPart } from "../shared/confirmation-presenter";
import { toolNameFromPart } from "../shared/turn-timeline";
import {
  customerNameFromPayload,
  formatTotal,
  isRecord,
  isSuccessfulToolOutput,
  unwrapToolOutput,
} from "./helpers";

export const ORDERS_GET_TOOLS = new Set(["orders_get", "orders.get"]);
export const ORDERS_CREATE_TOOLS = new Set(["orders_create", "orders.create"]);

export const ORDER_ENTITY_SURFACE_TOOLS = [
  "orders.get",
  "orders.create",
  "orders_get",
  "orders_create",
] as const;

export const ORDER_ENTITY_PROMPT_LINE =
  "After orders.get or orders.create, the UI already shows an order entity card. Reply with a short product-language summary. Do not dump tool JSON.";

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
 * N entity surfaces from live get/create parts. Isolation / permission
 * errors and HITL payloads are omitted.
 */
export function parseOrderEntitySurfaces(
  parts: readonly AssistantChatPart[],
  locale: Parameters<typeof ordersCopy>[0],
): readonly AssistantOrderEntityCardView[] {
  const orders = ordersCopy(locale);
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
  return entityCards;
}
