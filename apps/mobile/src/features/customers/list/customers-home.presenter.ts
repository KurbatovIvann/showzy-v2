/**
 * Tab chrome decisions for the customers home (SHO-179).
 */
export type CustomersTab =
  "clients" | "groups" | "counterparties" | "invitations";

export const CUSTOMERS_TABS: readonly CustomersTab[] = [
  "clients",
  "groups",
  "counterparties",
  "invitations",
];

export function customersTabOptions(labels: {
  readonly clients: string;
  readonly groups: string;
  readonly counterparties: string;
  readonly invitations: string;
}): ReadonlyArray<{ readonly key: CustomersTab; readonly label: string }> {
  return CUSTOMERS_TABS.map((key) => ({ key, label: labels[key] }));
}

export function isCustomersTabImplemented(tab: CustomersTab): boolean {
  return tab === "clients" || tab === "groups" || tab === "counterparties";
}

export function canShowCustomersCreate(args: {
  readonly tab: CustomersTab;
  readonly canCreateCustomers: boolean;
  readonly canEditCustomers: boolean;
}): boolean {
  if (args.tab === "clients") {
    return args.canCreateCustomers;
  }
  if (args.tab === "groups" || args.tab === "counterparties") {
    return args.canEditCustomers;
  }
  return false;
}

export type CustomersCreateKind = "client" | "group" | "counterparty";

export function customersCreateKind(
  tab: CustomersTab,
): CustomersCreateKind | null {
  if (tab === "clients") {
    return "client";
  }
  if (tab === "groups") {
    return "group";
  }
  if (tab === "counterparties") {
    return "counterparty";
  }
  return null;
}

export function customersCreateLabel(
  kind: CustomersCreateKind | null,
  labels: {
    readonly client: string;
    readonly group: string;
    readonly counterparty: string;
  },
): string {
  switch (kind) {
    case "client":
      return labels.client;
    case "group":
      return labels.group;
    case "counterparty":
      return labels.counterparty;
    case null:
      // Invitations hides +; do not reuse the client label.
      return "";
  }
}

export { shouldDrainNextPage } from "../shared/drain-pages";

export function lookupPagesSettled(args: {
  readonly status: "pending" | "error" | "success";
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
}): boolean {
  if (args.status === "pending") {
    return false;
  }
  if (args.status === "error") {
    return true;
  }
  return !args.hasNextPage && !args.isFetchingNextPage;
}
