import { describe, expect, it } from "vitest";

import { indexOfTabKey } from "../../../components/ui/tab-view.model";
import {
  canShowCustomersCreate,
  customersCreateKind,
  customersCreateLabel,
  customersHomeBanner,
  customersTabOptions,
  isCustomersTabImplemented,
  lookupPagesSettled,
  shouldDrainNextPage,
} from "./customers-home.presenter";

describe("customers home tabs", () => {
  it("treats invitations as live alongside the other CRM tabs", () => {
    expect(isCustomersTabImplemented("clients")).toBe(true);
    expect(isCustomersTabImplemented("groups")).toBe(true);
    expect(isCustomersTabImplemented("counterparties")).toBe(true);
    expect(isCustomersTabImplemented("invitations")).toBe(true);
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

  it("hides + without create (clients), edit (groups/counterparties), or invite (invitations)", () => {
    expect(
      canShowCustomersCreate({
        tab: "clients",
        canCreateCustomers: true,
        canEditCustomers: true,
        canInviteCustomers: true,
      }),
    ).toBe(true);
    expect(
      canShowCustomersCreate({
        tab: "clients",
        canCreateCustomers: false,
        canEditCustomers: true,
        canInviteCustomers: true,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "groups",
        canCreateCustomers: true,
        canEditCustomers: false,
        canInviteCustomers: true,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "counterparties",
        canCreateCustomers: true,
        canEditCustomers: true,
        canInviteCustomers: true,
      }),
    ).toBe(true);
    expect(
      canShowCustomersCreate({
        tab: "counterparties",
        canCreateCustomers: true,
        canEditCustomers: false,
        canInviteCustomers: true,
      }),
    ).toBe(false);
    expect(
      canShowCustomersCreate({
        tab: "invitations",
        canCreateCustomers: true,
        canEditCustomers: true,
        canInviteCustomers: true,
      }),
    ).toBe(true);
    expect(
      canShowCustomersCreate({
        tab: "invitations",
        canCreateCustomers: true,
        canEditCustomers: true,
        canInviteCustomers: false,
      }),
    ).toBe(false);
    expect(customersCreateKind("clients")).toBe("client");
    expect(customersCreateKind("groups")).toBe("group");
    expect(customersCreateKind("counterparties")).toBe("counterparty");
    expect(customersCreateKind("invitations")).toBe("invite");
    const labels = {
      client: "New client",
      group: "New group",
      counterparty: "New counterparty",
      invite: "New invitation",
    };
    expect(customersCreateLabel("client", labels)).toBe("New client");
    expect(customersCreateLabel("group", labels)).toBe("New group");
    expect(customersCreateLabel("counterparty", labels)).toBe(
      "New counterparty",
    );
    expect(customersCreateLabel("invite", labels)).toBe("New invitation");
    expect(customersCreateLabel(null, labels)).toBe("");
    expect(customersCreateLabel(null, labels)).not.toBe(labels.client);
  });
});

describe("customers home banner", () => {
  it("shows the visible tab's banner instead of first-non-null coalescing", () => {
    const banners = {
      clients: "client failed",
      groups: "group failed",
      counterparties: null,
      invitations: "invite failed",
    };
    expect(customersHomeBanner("clients", banners)).toBe("client failed");
    expect(customersHomeBanner("groups", banners)).toBe("group failed");
    expect(customersHomeBanner("counterparties", banners)).toBeNull();
    expect(customersHomeBanner("invitations", banners)).toBe("invite failed");
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
