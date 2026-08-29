/**
 * Order / counterparty picker labels (SHO-238). Totals are the order
 * list snapshot — do not reprice on the client.
 */
import { formatMoneyMinor } from "../../../format/money";
import type { DocumentOrderListItem } from "../api/order-list-query";

export function documentOrderOptionName(order: DocumentOrderListItem): string {
  return `#${String(order.orderNumber)}`;
}

export function documentOrderOptionDescription(
  order: DocumentOrderListItem,
): string {
  return formatMoneyMinor(order.totalGrossMinor, order.currency);
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
