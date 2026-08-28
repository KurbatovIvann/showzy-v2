import { describe, expect, it } from "vitest";

import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";

import type { CustomerListItem } from "../api/customer.queries";
import { nameById } from "../shared/paged-list";
import {
  classifyClientsList,
  clientRowActions,
  clientsChipKey,
  groupChipOptions,
  listCustomersPageInput,
  parseClientsChipKey,
  shouldResetMissingGroupFilter,
  toClientRowView,
  customersProbeState,
  LIST_CUSTOMERS_SEARCH_MAX as presenterSearchMax,
} from "./clients-list.presenter";

function item(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
    name: "Марія Коваль",
    phone: "+380501112233",
    email: "maria@example.com",
    userId: null,
    notes: null,
    groupId: "11111111-1111-4111-8111-111111111111",
    priceListId: "22222222-2222-4222-8222-222222222222",
    status: "active",
    linkedCounterpartyCount: 1,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("clients filter chips", () => {
  it("re-exports the validation search cap", () => {
    expect(presenterSearchMax).toBe(LIST_CUSTOMERS_SEARCH_MAX);
  });

  it("round-trips all / archived / group keys", () => {
    expect(parseClientsChipKey("all")).toEqual({ kind: "all" });
    expect(parseClientsChipKey("archived")).toEqual({ kind: "archived" });
    expect(
      parseClientsChipKey("group:11111111-1111-4111-8111-111111111111"),
    ).toEqual({
      kind: "group",
      groupId: "11111111-1111-4111-8111-111111111111",
    });
    expect(clientsChipKey({ kind: "all" })).toBe("all");
    expect(
      clientsChipKey({
        kind: "group",
        groupId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe("group:11111111-1111-4111-8111-111111111111");
  });

  it("maps chips onto listCustomers input; default all is active", () => {
    expect(listCustomersPageInput({ kind: "all" }, undefined)).toEqual({
      status: "active",
    });
    expect(listCustomersPageInput({ kind: "archived" }, "марія")).toEqual({
      status: "archived",
      search: "марія",
    });
    expect(
      listCustomersPageInput(
        { kind: "group", groupId: "11111111-1111-4111-8111-111111111111" },
        undefined,
      ),
    ).toEqual({
      status: "active",
      groupId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("builds Усі + one chip per group + Архів", () => {
    expect(
      groupChipOptions([{ id: "g1", name: "VIP" }], {
        all: "Усі",
        archived: "Архів",
      }),
    ).toEqual([
      { key: "all", label: "Усі" },
      { key: "group:g1", label: "VIP" },
      { key: "archived", label: "Архів" },
    ]);
  });
});

describe("toClientRowView", () => {
  it("maps a contract row onto primitives and omits order counts", () => {
    const view = toClientRowView(
      item({ status: "archived", linkedCounterpartyCount: 2 }),
      nameById([{ id: "11111111-1111-4111-8111-111111111111", name: "VIP" }]),
      nameById([{ id: "22222222-2222-4222-8222-222222222222", name: "Опт" }]),
    );
    expect(view).toEqual({
      id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
      name: "Марія Коваль",
      archived: true,
      groupName: "VIP",
      phone: "+380501112233",
      email: "maria@example.com",
      priceListName: "Опт",
      linkedCounterpartyCount: 2,
    });
    expect(view).not.toHaveProperty("orderCount");
  });
});

describe("customersProbeState", () => {
  it("is idle while disabled and loading until the probe resolves", () => {
    expect(
      customersProbeState({
        enabled: false,
        status: "pending",
        itemCount: undefined,
      }),
    ).toBe("idle");
    expect(
      customersProbeState({
        enabled: true,
        status: "pending",
        itemCount: undefined,
      }),
    ).toBe("loading");
    expect(
      customersProbeState({ enabled: true, status: "success", itemCount: 0 }),
    ).toBe("empty");
    expect(
      customersProbeState({ enabled: true, status: "success", itemCount: 1 }),
    ).toBe("nonempty");
  });
});

describe("classifyClientsList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    hasSearch: false,
    filter: { kind: "all" } as const,
    probe: "empty" as const,
  };

  it("is an error when the client is not ready", () => {
    expect(classifyClientsList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("splits offline from other failures", () => {
    expect(
      classifyClientsList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyClientsList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("prefers search and group-filter empty states", () => {
    expect(
      classifyClientsList({
        ...base,
        hasSearch: true,
        filter: { kind: "archived" },
      }),
    ).toEqual({ kind: "empty-search" });
    expect(
      classifyClientsList({
        ...base,
        filter: { kind: "group", groupId: "g1" },
      }),
    ).toEqual({ kind: "empty-search" });
  });

  it("consults the probe for an empty default (active) chip", () => {
    expect(classifyClientsList({ ...base, probe: "loading" })).toEqual({
      kind: "loading",
    });
    expect(classifyClientsList({ ...base, probe: "empty" })).toEqual({
      kind: "empty-catalog",
    });
    expect(classifyClientsList({ ...base, probe: "nonempty" })).toEqual({
      kind: "empty-active",
    });
  });

  it("maps the archived chip to its empty state", () => {
    expect(
      classifyClientsList({ ...base, filter: { kind: "archived" } }),
    ).toEqual({ kind: "empty-archived" });
  });
});

describe("clientRowActions", () => {
  it("hides archive/restore/edit without edit, and delete without delete", () => {
    expect(
      clientRowActions({
        archived: false,
        canEdit: false,
        canDelete: false,
      }),
    ).toEqual({
      showEdit: false,
      showArchive: false,
      showDelete: false,
      showRestore: false,
    });
    expect(
      clientRowActions({
        archived: false,
        canEdit: true,
        canDelete: false,
      }),
    ).toEqual({
      showEdit: true,
      showArchive: true,
      showDelete: false,
      showRestore: false,
    });
    expect(
      clientRowActions({
        archived: true,
        canEdit: true,
        canDelete: true,
      }),
    ).toEqual({
      showEdit: true,
      showArchive: false,
      showDelete: true,
      showRestore: true,
    });
  });
});

describe("shouldResetMissingGroupFilter", () => {
  it("waits until lookups settle, then drops a missing group chip", () => {
    const filter = {
      kind: "group" as const,
      groupId: "g1",
    };
    expect(
      shouldResetMissingGroupFilter({
        filter,
        groupIds: [],
        lookupSettled: false,
      }),
    ).toBe(false);
    expect(
      shouldResetMissingGroupFilter({
        filter,
        groupIds: ["g1"],
        lookupSettled: true,
      }),
    ).toBe(false);
    expect(
      shouldResetMissingGroupFilter({
        filter,
        groupIds: ["g2"],
        lookupSettled: true,
      }),
    ).toBe(true);
    expect(
      shouldResetMissingGroupFilter({
        filter: { kind: "all" },
        groupIds: [],
        lookupSettled: true,
      }),
    ).toBe(false);
  });
});
