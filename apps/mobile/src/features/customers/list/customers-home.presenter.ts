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

export function isCustomersTabImplemented(tab: CustomersTab): boolean {
  return tab === "clients" || tab === "groups";
}

export function canShowCustomersCreate(args: {
  readonly tab: CustomersTab;
  readonly canCreateCustomers: boolean;
  readonly canEditCustomers: boolean;
}): boolean {
  if (args.tab === "clients") {
    return args.canCreateCustomers;
  }
  if (args.tab === "groups") {
    return args.canEditCustomers;
  }
  return false;
}

export function customersCreateKind(
  tab: CustomersTab,
): "client" | "group" | null {
  if (tab === "clients") {
    return "client";
  }
  if (tab === "groups") {
    return "group";
  }
  return null;
}

export function shouldDrainNextPage(args: {
  readonly status: "pending" | "error" | "success";
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
}): boolean {
  return (
    args.status === "success" && args.hasNextPage && !args.isFetchingNextPage
  );
}

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
