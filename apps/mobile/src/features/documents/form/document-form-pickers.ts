/**
 * Order / counterparty picker labels (SHO-238). Totals are the order
 * list snapshot — do not reprice on the client. Customer name is the
 * primary order label; a linked legal face is a subtitle when it
 * differs from the CRM snapshot.
 */
import { formatMoneyMinor } from "../../../format/money";
import type { DocumentOrderListItem } from "../api/order-list-query";

/** Sentinel persisted on unlinked headers; matches `orders.list`. */
export const UNLINKED_CUSTOMER_NAME_SNAPSHOT = "unlinked";

export function documentOrderOptionName(
  order: DocumentOrderListItem,
  missingCustomer: string,
): string {
  if (order.customer.nameSnapshot === UNLINKED_CUSTOMER_NAME_SNAPSHOT) {
    return missingCustomer;
  }
  return order.customer.nameSnapshot;
}

export function documentOrderOptionDescription(
  order: DocumentOrderListItem,
  counterpartyName: string | null,
): string {
  const total = formatMoneyMinor(order.totalGrossMinor, order.currency);
  const number = `#${order.orderNumber}`;
  if (
    counterpartyName !== null &&
    counterpartyName.length > 0 &&
    counterpartyName !== order.customer.nameSnapshot
  ) {
    return `${counterpartyName} · ${number} · ${total}`;
  }
  return `${number} · ${total}`;
}

export function firstCounterpartyNameByCustomerId(
  rows: ReadonlyArray<{
    readonly customerId: string | null;
    readonly name: string;
  }>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.customerId === null) {
      continue;
    }
    if (!map.has(row.customerId)) {
      map.set(row.customerId, row.name);
    }
  }
  return map;
}

export function documentCounterpartyOptionDescription(row: {
  readonly edrpou: string | null;
}): string | null {
  if (row.edrpou === null || row.edrpou.length === 0) {
    return null;
  }
  return row.edrpou;
}

export function counterpartyPickerEnabled(args: {
  readonly orderId: string;
  readonly customerId: string | null;
}): boolean {
  return args.orderId.length > 0 && args.customerId !== null;
}
