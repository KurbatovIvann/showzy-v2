/**
 * Pure picker helpers for the counterparty form (SHO-196). Keep an
 * already-linked (possibly archived) customer in the sheet even when
 * `listCustomers` defaults to active.
 */
import type { OptionSelectItem } from "../shared/option-select";

export function ensureLinkedCustomerOption(args: {
  readonly options: readonly OptionSelectItem[];
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly unnamedFallback: string;
}): readonly OptionSelectItem[] {
  const customerId = args.customerId;
  if (customerId === null) {
    return args.options;
  }
  if (args.options.some((option) => option.id === customerId)) {
    return args.options;
  }
  const name =
    args.customerName != null && args.customerName.length > 0
      ? args.customerName
      : args.unnamedFallback;
  return [{ id: customerId, name }, ...args.options];
}
