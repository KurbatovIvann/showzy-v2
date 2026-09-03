/**
 * Pure view-model logic for the web order detail (SHO-378). Line prices
 * are snapshots from `orders.get` — never client reprice.
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { OrdersCopy, OrdersDetailCopy } from "../../../i18n/orders";
import type { GetOrderOutput } from "../api/get";
import type { OrderQueryLoadState } from "../shared/classify-order-load";
import {
  customerNameLabel,
  type CustomerNameHydration,
} from "../shared/customer-name";
import {
  formatOrderMoney,
  formatOrderQuantityMilli,
} from "../shared/format-order-money";
import type { OrderDetailActions } from "../shared/order-permissions";
import {
  orderStatusTone,
  type OrderLifecycleStatus,
  type OrderStatusTone,
} from "../shared/order-status";

const TIMES = "\u00D7";

export function commentIfPresent(comment: string | null): string | null {
  if (comment === null) {
    return null;
  }
  const trimmed = comment.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function customerPhoneIfPresent(phone: string | null): string | null {
  if (phone === null) {
    return null;
  }
  const trimmed = phone.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Canvas PhoneIcon beside the number — visual only, no `tel:`. */
export function orderDetailShowsPhoneIcon(phone: string | null): boolean {
  return customerPhoneIfPresent(phone) !== null;
}

export function formatOrderNumber(orderNumber: string): string {
  return `#${orderNumber}`;
}

export type OrderDetailLineView = {
  readonly itemId: string;
  readonly title: string;
  readonly metaLabel: string;
  readonly grossLabel: string;
};

export type OrderDetailViewModel = {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: OrderLifecycleStatus;
  readonly statusLabel: string;
  readonly statusTone: OrderStatusTone;
  readonly comment: string | null;
  readonly dueLabel: string;
  readonly lines: readonly OrderDetailLineView[];
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly showPhoneIcon: boolean;
};

export function toOrderDetailView(args: {
  readonly order: GetOrderOutput;
  readonly copy: OrdersCopy;
  readonly customer: CustomerNameHydration;
  readonly customerPhone: string | null;
}): OrderDetailViewModel {
  const customerPhone = customerPhoneIfPresent(args.customerPhone);
  return {
    orderId: args.order.orderId,
    orderNumber: args.order.orderNumber,
    status: args.order.status,
    statusLabel: args.copy.statuses[args.order.status],
    statusTone: orderStatusTone(args.order.status),
    comment: commentIfPresent(args.order.comment),
    dueLabel: formatOrderMoney(args.order.totalGrossMinor, args.order.currency),
    lines: args.order.items.map((item) => {
      const unitLabel = formatOrderMoney(item.unitPriceMinor, item.currency);
      const qtyLabel = formatOrderQuantityMilli(item.quantityMilli);
      return {
        itemId: item.itemId,
        title: item.titleSnapshot,
        metaLabel: `${unitLabel} ${TIMES} ${qtyLabel}`,
        grossLabel: formatOrderMoney(item.grossAmountMinor, item.currency),
      };
    }),
    customerName: customerNameLabel(args.customer, args.copy.missingCustomer),
    customerPhone,
    showPhoneIcon: orderDetailShowsPhoneIcon(customerPhone),
  };
}

export function orderDetailHeaderTitle(args: {
  readonly orderNumber: string | null;
  readonly fallbackTitle: string;
}): string {
  if (args.orderNumber === null) {
    return args.fallbackTitle;
  }
  return formatOrderNumber(args.orderNumber);
}

export function orderDetailWriteChrome(args: {
  readonly stateKind: OrderQueryLoadState["kind"];
  readonly hasOrder: boolean;
  readonly actionFlags: OrderDetailActions;
}): OrderDetailActions {
  const ready = args.stateKind === "ready" && args.hasOrder;
  return {
    showConfirm: ready && args.actionFlags.showConfirm,
    showStart: ready && args.actionFlags.showStart,
    showComplete: ready && args.actionFlags.showComplete,
    showActions: ready && args.actionFlags.showActions,
    cancelEnabled: ready && args.actionFlags.cancelEnabled,
  };
}

export type OrderWriteBannerKey = "offline" | "permission" | "error";

export function mapOrderWriteFailure(
  kind: QueryFailureKind | null,
): OrderWriteBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "offline" || kind === "network") {
    return "offline";
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "confirmation") {
    return null;
  }
  return "error";
}

export function orderWriteBanner(
  key: OrderWriteBannerKey | null,
  copy: OrdersDetailCopy,
): string | null {
  if (key === null) {
    return null;
  }
  if (key === "offline") {
    return copy.mutationOffline;
  }
  if (key === "permission") {
    return copy.mutationPermission;
  }
  return copy.mutationError;
}

export function planOrderStatusWrite(isError: boolean): "retry" | "submit" {
  return isError ? "retry" : "submit";
}
