/**
 * Pure view-model logic for the counterparties list (SHO-195).
 */
import { LIST_COUNTERPARTIES_SEARCH_MAX } from "@showzy/validation/customers";

import type { QueryFailureKind } from "../../../api/errors";
import type {
  CounterpartyListItem,
  ListCounterpartiesPageInput,
} from "../api/counterparty.queries";
import { flattenPages, normalizeCustomersSearch } from "../shared/paged-list";

export { LIST_COUNTERPARTIES_SEARCH_MAX };
export { normalizeCustomersSearch };

export function listCounterpartiesPageInput(
  search: string | undefined,
): ListCounterpartiesPageInput {
  return search === undefined ? {} : { search };
}

export type CounterpartyRowView = {
  readonly id: string;
  readonly name: string;
  readonly edrpou: string | null;
  readonly customerId: string | null;
  readonly customerName: string | null;
};

export function toCounterpartyRowView(
  item: CounterpartyListItem,
): CounterpartyRowView {
  return {
    id: item.id,
    name: item.name,
    edrpou: item.edrpou,
    customerId: item.customerId,
    customerName: item.customerName,
  };
}

export type CounterpartiesListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-search" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "rows" };

export function classifyCounterpartiesList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly hasSearch: boolean;
}): CounterpartiesListState {
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
  return args.hasSearch ? { kind: "empty-search" } : { kind: "empty-catalog" };
}

export function flattenCounterpartyListPages(
  pages: ReadonlyArray<{ readonly items: readonly CounterpartyListItem[] }>,
): readonly CounterpartyListItem[] {
  return flattenPages(pages);
}

export type CounterpartyRowActions = {
  readonly showEdit: boolean;
  readonly showDelete: boolean;
};

/** Counterparty delete is `customers:edit`, not `customers:delete`. */
export function counterpartyRowActions(
  canEdit: boolean,
): CounterpartyRowActions {
  return {
    showEdit: canEdit,
    showDelete: canEdit,
  };
}
