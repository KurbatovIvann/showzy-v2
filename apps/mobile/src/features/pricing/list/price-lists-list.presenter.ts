/**
 * Pure view-model logic for the price-lists list (SHO-189). No React
 * Native imports so the whole decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import type {
  ListPriceListsPageInput,
  PriceListItem,
  PriceListsAvailability,
} from "../api/price-list.queries";
import {
  LIST_PRICE_LISTS_QUERY_MAX,
  PRICE_LISTS_HINT_MAX,
} from "../shared/price-list-caps";

export { LIST_PRICE_LISTS_QUERY_MAX, PRICE_LISTS_HINT_MAX };

/** Empty and whitespace-only searches are "no search" — the action rejects them. */
export function normalizePriceListsSearch(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, LIST_PRICE_LISTS_QUERY_MAX);
}

export function listPriceListsPageInput(
  availability: PriceListsAvailability,
  search: string | undefined,
): ListPriceListsPageInput {
  return {
    availability,
    ...(search === undefined ? {} : { query: search }),
  };
}

export function flattenPriceListPages(
  pages: ReadonlyArray<{ readonly items: readonly PriceListItem[] }>,
): readonly PriceListItem[] {
  return pages.flatMap((page) => page.items);
}

export type PriceListRowView = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly entryCount: number;
};

export function toPriceListRowView(item: PriceListItem): PriceListRowView {
  return {
    id: item.id,
    name: item.name,
    isDefault: item.isDefault,
    isActive: item.isActive,
    entryCount: item.entryCount,
  };
}

export type PriceListsListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-filtered" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "rows" };

/**
 * Canvas state machine: skeletons while loading, offline vs error, then
 * filtered-empty vs catalog-empty. Availability chips other than `all`
 * count as a filter (no second probe query).
 */
export function classifyPriceListsList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly hasSearch: boolean;
  readonly availability: PriceListsAvailability;
}): PriceListsListState {
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    return args.failureKind === "offline"
      ? { kind: "offline" }
      : { kind: "error" };
  }
  if (args.rowCount > 0) {
    return { kind: "rows" };
  }
  if (args.hasSearch || args.availability !== "all") {
    return { kind: "empty-filtered" };
  }
  return { kind: "empty-catalog" };
}

export type PriceListRowActions = {
  readonly showEdit: boolean;
  readonly showOptions: boolean;
};

export function priceListRowActions(args: {
  readonly canManage: boolean;
}): PriceListRowActions {
  return {
    showEdit: args.canManage,
    showOptions: args.canManage,
  };
}

export type PriceListOptionVisibility = {
  readonly showSetDefault: boolean;
  readonly showClearDefault: boolean;
  readonly showActivate: boolean;
  readonly showDeactivate: boolean;
  readonly showDelete: boolean;
  readonly deactivateBlocked: boolean;
};

export function priceListOptionVisibility(args: {
  readonly canManage: boolean;
  readonly isDefault: boolean;
  readonly isActive: boolean;
}): PriceListOptionVisibility {
  return {
    showSetDefault: args.canManage && !args.isDefault,
    showClearDefault: args.canManage && args.isDefault,
    showActivate: args.canManage && !args.isActive,
    showDeactivate: args.canManage && args.isActive,
    showDelete: args.canManage,
    deactivateBlocked: args.isDefault && args.isActive,
  };
}

export function shouldBlockDeactivateDefault(args: {
  readonly isDefault: boolean;
  readonly isActive: boolean;
}): boolean {
  return args.isDefault && args.isActive;
}

export function shouldShowPriceListsHint(args: {
  readonly rowCount: number;
  readonly hasNextPage: boolean;
  readonly hasSearch: boolean;
  readonly availability: PriceListsAvailability;
}): boolean {
  return (
    !args.hasSearch &&
    args.availability === "all" &&
    args.rowCount > 0 &&
    args.rowCount < PRICE_LISTS_HINT_MAX &&
    !args.hasNextPage
  );
}
