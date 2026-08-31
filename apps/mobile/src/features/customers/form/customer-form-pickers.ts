/**
 * Client-form inherit and Юрособи body decisions (SHO-180).
 * Picker item mapping (`optionSelectItems`, `selectorLookupValue`) lives
 * in `shared/option-select.ts` (`optionSelectItems` re-exports the shared
 * helper). Invitation create may import
 * these inherit helpers so it copies client assignment UX; do not move
 * them into `shared/`.
 */
import type { CustomerFormMode } from "./customer-form-draft";

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
