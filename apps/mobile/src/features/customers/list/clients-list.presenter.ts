/**
 * Pure view-model logic for the clients list (SHO-179). No React Native
 * imports so the whole decision surface is unit-testable.
 */
import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";

import type { QueryFailureKind } from "../../../api/errors";
import type {
  CustomerListItem,
  ListCustomersPageInput,
} from "../api/customer.queries";
import type { GroupListItem } from "../api/group.queries";
import type { PriceListItem } from "../api/price-list.queries";

export { LIST_CUSTOMERS_SEARCH_MAX };

export type ClientsFilter =
  | { readonly kind: "all" }
  | { readonly kind: "archived" }
  | { readonly kind: "group"; readonly groupId: string };

export function normalizeCustomersSearch(
  text: string,
  maxLength: number,
): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

export function clientsChipKey(filter: ClientsFilter): string {
  if (filter.kind === "group") {
    return `group:${filter.groupId}`;
  }
  return filter.kind;
}

export function parseClientsChipKey(key: string): ClientsFilter {
  if (key === "archived") {
    return { kind: "archived" };
  }
  if (key.startsWith("group:")) {
    const groupId = key.slice("group:".length);
    if (groupId.length > 0) {
      return { kind: "group", groupId };
    }
  }
  return { kind: "all" };
}

export function listCustomersPageInput(
  filter: ClientsFilter,
  search: string | undefined,
): ListCustomersPageInput {
  const searchField = search === undefined ? {} : { search };
  if (filter.kind === "archived") {
    return { status: "archived", ...searchField };
  }
  if (filter.kind === "group") {
    return { status: "active", groupId: filter.groupId, ...searchField };
  }
  return { status: "active", ...searchField };
}

export function flattenPages<T>(
  pages: ReadonlyArray<{ readonly items: readonly T[] }>,
): readonly T[] {
  return pages.flatMap((page) => page.items);
}

export function nameById(
  items: ReadonlyArray<{ readonly id: string; readonly name: string }>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.id, item.name);
  }
  return map;
}

export type ClientRowView = {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly groupName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly priceListName: string | null;
  readonly linkedCounterpartyCount: number;
};

export function toClientRowView(
  item: CustomerListItem,
  groups: ReadonlyMap<string, string>,
  priceLists: ReadonlyMap<string, string>,
): ClientRowView {
  return {
    id: item.id,
    name: item.name,
    archived: item.status === "archived",
    groupName:
      item.groupId === null ? null : (groups.get(item.groupId) ?? null),
    phone: item.phone,
    email: item.email,
    priceListName:
      item.priceListId === null
        ? null
        : (priceLists.get(item.priceListId) ?? null),
    linkedCounterpartyCount: item.linkedCounterpartyCount,
  };
}

export type CustomersProbeState =
  "idle" | "loading" | "empty" | "nonempty" | "error";

export function customersProbeState(args: {
  readonly enabled: boolean;
  readonly status: "pending" | "error" | "success";
  readonly itemCount: number | undefined;
}): CustomersProbeState {
  if (!args.enabled) {
    return "idle";
  }
  if (args.status === "pending") {
    return "loading";
  }
  if (args.status === "error") {
    return "error";
  }
  return (args.itemCount ?? 0) > 0 ? "nonempty" : "empty";
}

export type ClientsListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-search" }
  | { readonly kind: "empty-archived" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "empty-active" }
  | { readonly kind: "rows" };

/**
 * Canvas state machine plus the catalog probe: skeletons while loading,
 * offline vs error, then per-filter empty states. An empty default chip
 * consults the probe to tell "CRM is empty" (create CTA) apart from
 * "everything is archived" (show-archive CTA).
 */
export function classifyClientsList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly hasSearch: boolean;
  readonly filter: ClientsFilter;
  readonly probe: CustomersProbeState;
}): ClientsListState {
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
  if (args.hasSearch || args.filter.kind === "group") {
    return { kind: "empty-search" };
  }
  if (args.filter.kind === "archived") {
    return { kind: "empty-archived" };
  }
  if (args.probe === "loading" || args.probe === "idle") {
    return { kind: "loading" };
  }
  return args.probe === "nonempty"
    ? { kind: "empty-active" }
    : { kind: "empty-catalog" };
}

export function groupChipOptions(
  groups: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  copy: { readonly all: string; readonly archived: string },
): ReadonlyArray<{ readonly key: string; readonly label: string }> {
  return [
    { key: "all", label: copy.all },
    ...groups.map((group) => ({ key: `group:${group.id}`, label: group.name })),
    { key: "archived", label: copy.archived },
  ];
}

export function flattenGroupPages(
  pages: ReadonlyArray<{ readonly items: readonly GroupListItem[] }>,
): readonly GroupListItem[] {
  return flattenPages(pages);
}

export function flattenPriceListPages(
  pages: ReadonlyArray<{ readonly items: readonly PriceListItem[] }>,
): readonly PriceListItem[] {
  return flattenPages(pages);
}

export type ClientRowActions = {
  readonly showEdit: boolean;
  readonly showArchive: boolean;
  readonly showDelete: boolean;
  readonly showRestore: boolean;
};

export function clientRowActions(args: {
  readonly archived: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}): ClientRowActions {
  return {
    showEdit: args.canEdit,
    showArchive: !args.archived && args.canEdit,
    showDelete: args.archived && args.canDelete,
    showRestore: args.archived && args.canEdit,
  };
}

export function shouldResetMissingGroupFilter(args: {
  readonly filter: ClientsFilter;
  readonly groupIds: ReadonlyArray<string>;
  readonly lookupSettled: boolean;
}): boolean {
  if (args.filter.kind !== "group" || !args.lookupSettled) {
    return false;
  }
  return !args.groupIds.includes(args.filter.groupId);
}
