import { describe, expect, it } from "vitest";

import { indexOfTabKey } from "../../../components/ui/tab-view.model";
import {
  canShowCustomersCreate,
  customersCreateKind,
  customersTabOptions,
  isCustomersTabImplemented,
  lookupPagesSettled,
  shouldDrainNextPage,
} from "./customers-home.presenter";

describe("customers home tabs", () => {
  it("treats counterparties and invitations as unimplemented", () => {
    expect(isCustomersTabImplemented("clients")).toBe(true);
    expect(isCustomersTabImplemented("groups")).toBe(true);
    expect(isCustomersTabImplemented("counterparties")).toBe(false);
    expect(isCustomersTabImplemented("invitations")).toBe(false);
  });

  it("lists tab options in canvas order", () => {
    const tabs = customersTabOptions({
      clients: "Clients",
      groups: "Groups",
      counterparties: "Counterparties",
      invitations: "Invitations",
    });
    expect(tabs.map((tab) => tab.key)).toEqual([
      "clients",
      "groups",
      "counterparties",
      "invitations",
    ]);
    expect(indexOfTabKey(tabs, "groups")).toBe(1);
    expect(indexOfTabKey(tabs, "invitations")).toBe(3);
  });

  it("hides + without create (clients) or edit (groups), and on coming-soon tabs", () => {
    expect(
      canShowCustomersCreate({
        tab: "clients",
        canCreateCustomers: true,
        canEditCustomers: true,
      }),
    ).toBe(true);
    expect(
      canShowCustomersCreate({
        tab: "clients",
        canCreateCustomers: false,
        canEditCustomers: true,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "groups",
        canCreateCustomers: true,
        canEditCustomers: false,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "counterparties",
        canCreateCustomers: true,
        canEditCustomers: true,
      }),
    ).toBe(false);
    expect(customersCreateKind("clients")).toBe("client");
    expect(customersCreateKind("groups")).toBe("group");
    expect(customersCreateKind("invitations")).toBeNull();
  });
});

describe("lookup page drain", () => {
  it("fetches the next page only after a successful page with a cursor", () => {
    expect(
      shouldDrainNextPage({
        status: "pending",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    ).toBe(false);
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
  });

  it("treats an error as settled so group chips can render without it", () => {
    expect(
      lookupPagesSettled({
        status: "pending",
        hasNextPage: false,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
    expect(
      lookupPagesSettled({
        status: "error",
        hasNextPage: false,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
    expect(
      lookupPagesSettled({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
    expect(
      lookupPagesSettled({
        status: "success",
        hasNextPage: false,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
  });
});
