import { describe, expect, it } from "vitest";

import { indexOfTabKey } from "../../../components/ui/tab-view.model";
import {
  canShowCustomersCreate,
  customersCreateKind,
  customersCreateLabel,
  customersTabOptions,
  isCustomersTabImplemented,
  lookupPagesSettled,
  shouldDrainNextPage,
} from "./customers-home.presenter";

describe("customers home tabs", () => {
  it("treats invitations as unimplemented and counterparties as live", () => {
    expect(isCustomersTabImplemented("clients")).toBe(true);
    expect(isCustomersTabImplemented("groups")).toBe(true);
    expect(isCustomersTabImplemented("counterparties")).toBe(true);
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

  it("hides + without create (clients) or edit (groups/counterparties), and on invitations", () => {
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
    ).toBe(true);
    expect(
      canShowCustomersCreate({
        tab: "counterparties",
        canCreateCustomers: true,
        canEditCustomers: false,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "invitations",
        canCreateCustomers: true,
        canEditCustomers: true,
      }),
    ).toBe(false);
    expect(customersCreateKind("clients")).toBe("client");
    expect(customersCreateKind("groups")).toBe("group");
    expect(customersCreateKind("counterparties")).toBe("counterparty");
    expect(customersCreateKind("invitations")).toBeNull();
    const labels = {
      client: "New client",
      group: "New group",
      counterparty: "New counterparty",
    };
    expect(customersCreateLabel("client", labels)).toBe("New client");
    expect(customersCreateLabel("group", labels)).toBe("New group");
    expect(customersCreateLabel("counterparty", labels)).toBe(
      "New counterparty",
    );
    expect(customersCreateLabel(null, labels)).toBe("");
    expect(customersCreateLabel(null, labels)).not.toBe(labels.client);
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
