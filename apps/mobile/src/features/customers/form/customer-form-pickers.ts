/**
 * Pure picker / Юрособи decisions for the customer form (SHO-180).
 * Names come from `pricing.listPriceLists` / `customers.listGroups`
 * only. Inherit copy is for a null assignment, never an unnamed id.
 */
import type { OptionSelectItem } from "../shared/option-select";
import type { CustomerFormMode } from "./customer-form-draft";

export function optionSelectItems(
  items: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string | null;
  }>,
): readonly OptionSelectItem[] {
  return items.map((item) => {
    const description =
      item.description != null && item.description.length > 0
        ? item.description
        : undefined;
    if (description === undefined) {
      return { id: item.id, name: item.name };
    }
    return { id: item.id, name: item.name, description };
  });
}

/**
 * Selector display: null id uses the inherit placeholder; a named id
 * uses the lookup; a still-set unnamed id uses `unnamedFallback` so it
 * is not shown as inherit.
 */
export function selectorLookupValue(
  id: string | null,
  names: ReadonlyMap<string, string>,
  unnamedFallback: string,
): string | undefined {
  if (id === null) {
    return undefined;
  }
  return names.get(id) ?? unnamedFallback;
}

export function groupAssignedPriceListId(
  groupId: string | null,
  priceListIdByGroupId: ReadonlyMap<string, string | null>,
): string | null {
  if (groupId === null) {
    return null;
  }
  return priceListIdByGroupId.get(groupId) ?? null;
}

export function inheritedPriceListPlaceholder(args: {
  readonly groupPriceListId: string | null;
  readonly inheritGroup: string;
  readonly retailDefault: string;
}): string {
  if (args.groupPriceListId !== null) {
    return args.inheritGroup;
  }
  return args.retailDefault;
}

export type CounterpartiesBodyKind =
  "create-hint" | "loading" | "empty" | "list" | "error";

export function counterpartiesBodyKind(args: {
  readonly mode: CustomerFormMode;
  readonly status: "idle" | "pending" | "error" | "success";
  readonly itemCount: number;
}): CounterpartiesBodyKind {
  if (args.mode === "create") {
    return "create-hint";
  }
  if (args.status === "pending" || args.status === "idle") {
    return "loading";
  }
  if (args.status === "error") {
    return "error";
  }
  if (args.itemCount <= 0) {
    return "empty";
  }
  return "list";
}

export function counterpartiesBodyCopy(args: {
  readonly kind: CounterpartiesBodyKind;
  readonly createHint: string;
  readonly empty: string;
  readonly error: string;
}): string | null {
  switch (args.kind) {
    case "create-hint":
      return args.createHint;
    case "empty":
      return args.empty;
    case "error":
      return args.error;
    case "loading":
    case "list":
      return null;
  }
}
