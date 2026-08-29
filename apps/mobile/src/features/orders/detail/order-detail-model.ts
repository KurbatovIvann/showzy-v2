/**
 * Pure view-model logic for the order detail screen (SHO-212).
 * No React Native imports so the decision surface is unit-testable.
 * Line prices are snapshots from `orders.get` — never client reprice.
 */
import { classifyWriteFailure } from "../../../api/classify-write-failure";
import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import type { OrdersCopy, OrdersDetailCopy } from "../../../i18n/orders";
import type { GetOrderOutput } from "../api/order-detail-query";
import type { OrderQueryLoadState } from "../shared/classify-order-load";
import {
  customerNameLabel,
  type CustomerNameHydration,
} from "../shared/customer-name";
import {
  orderDetailActions,
  type OrderDetailActions,
} from "../shared/order-permissions";
import {
  orderStatusTone,
  type OrderLifecycleStatus,
  type OrderStatusTone,
} from "../shared/order-status";

export type { OrderQueryLoadState as OrderDetailState };

const QUANTITY_MILLI_SCALE = 1000n;
const QUANTITY_WIRE = /^[1-9][0-9]*$/;
const GROUP_SEPARATOR = "\u00A0";
const TIMES = "\u00D7";

function groupDigits(digits: string): string {
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index;
    if (index > 0 && fromEnd % 3 === 0) {
      grouped += GROUP_SEPARATOR;
    }
    grouped += digits.charAt(index);
  }
  return grouped;
}

/**
 * Quantity milli is scale 3 (`1000` = 1). Trailing zeros after the
 * comma are omitted so `1000` → `1` and `1500` → `1,5`.
 */
export function formatQuantityMilli(wire: string): string {
  if (!QUANTITY_WIRE.test(wire)) {
    throw new TypeError("Expected a canonical positive integer string");
  }
  const milli = BigInt(wire);
  const units = milli / QUANTITY_MILLI_SCALE;
  const remainder = milli % QUANTITY_MILLI_SCALE;
  const grouped = groupDigits(units.toString(10));
  if (remainder === 0n) {
    return grouped;
  }
  const fraction = remainder.toString(10).padStart(3, "0").replace(/0+$/, "");
  return `${grouped},${fraction}`;
}

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

export type OrderDetailLineView = {
  readonly itemId: string;
  readonly title: string;
  readonly metaLabel: string;
  readonly grossLabel: string;
};

export type OrderDetailViewModel = {
  readonly orderId: string;
  readonly status: OrderLifecycleStatus;
  readonly statusLabel: string;
  readonly statusTone: OrderStatusTone;
  readonly comment: string | null;
  readonly dueLabel: string;
  readonly lines: readonly OrderDetailLineView[];
  readonly customerName: string;
  readonly customerNamePending: boolean;
  readonly customerPhone: string | null;
};

export function toOrderDetailView(args: {
  readonly order: GetOrderOutput;
  readonly copy: OrdersCopy;
  readonly customer: CustomerNameHydration;
  readonly customerPhone: string | null;
}): OrderDetailViewModel {
  return {
    orderId: args.order.orderId,
    status: args.order.status,
    statusLabel: args.copy.statuses[args.order.status],
    statusTone: orderStatusTone(args.order.status),
    comment: commentIfPresent(args.order.comment),
    dueLabel: formatMoneyMinor(args.order.totalGrossMinor, args.order.currency),
    lines: args.order.items.map((item) => {
      const unitLabel = formatMoneyMinor(item.unitPriceMinor, item.currency);
      const qtyLabel = formatQuantityMilli(item.quantityMilli);
      return {
        itemId: item.itemId,
        title: item.titleSnapshot,
        metaLabel: `${unitLabel} ${TIMES} ${qtyLabel}`,
        grossLabel: formatMoneyMinor(item.grossAmountMinor, item.currency),
      };
    }),
    customerName: customerNameLabel(args.customer, args.copy.missingCustomer),
    customerNamePending: args.customer.kind === "pending",
    customerPhone: customerPhoneIfPresent(args.customerPhone),
  };
}

export function orderDetailHeaderTitle(args: {
  readonly customer: CustomerNameHydration;
  readonly fallbackTitle: string;
  readonly missingCustomer: string;
}): string {
  if (args.customer.kind === "ready") {
    return args.customer.name;
  }
  if (args.customer.kind === "missing") {
    return args.missingCustomer;
  }
  return args.fallbackTitle;
}

export function orderDetailActionsForView(args: {
  readonly canEdit: boolean;
  readonly status: OrderLifecycleStatus;
}): OrderDetailActions {
  return orderDetailActions(args);
}

/**
 * Confirm / ⋯ stay hidden unless the query is ready. TanStack keeps
 * `data` on error/offline after a successful get — a stale VM must not
 * keep write chrome up (catalog `product-detail-view` gates on ready).
 */
export function orderDetailWriteChrome(args: {
  readonly stateKind: OrderQueryLoadState["kind"];
  readonly hasOrder: boolean;
  readonly actionFlags: OrderDetailActions;
}): OrderDetailActions {
  const ready = args.stateKind === "ready" && args.hasOrder;
  return {
    showConfirm: ready && args.actionFlags.showConfirm,
    showActions: ready && args.actionFlags.showActions,
    cancelEnabled: ready && args.actionFlags.cancelEnabled,
  };
}

/**
 * Confirm footer loading is confirm-in-flight only. Cancel pending
 * belongs to the actions sheet; it must not OR into Confirm (catalog
 * `product-detail-view` keeps footer independent of sheet pending).
 */
export function orderDetailConfirmLoading(args: {
  readonly confirmPending: boolean;
  readonly cancelPending: boolean;
}): boolean {
  return args.confirmPending;
}

export type OrderWriteBannerKey = "offline" | "permission" | "error";

export function mapOrderWriteFailure(
  kind: QueryFailureKind | null,
): OrderWriteBannerKey | null {
  return classifyWriteFailure(kind);
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
