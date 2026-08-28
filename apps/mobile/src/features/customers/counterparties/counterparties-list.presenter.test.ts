import { describe, expect, it } from "vitest";

import { LIST_COUNTERPARTIES_SEARCH_MAX } from "@showzy/validation/customers";

import type { CounterpartyListItem } from "../api/counterparty.queries";
import {
  classifyCounterpartiesList,
  counterpartyRowActions,
  listCounterpartiesPageInput,
  normalizeCustomersSearch,
  toCounterpartyRowView,
  LIST_COUNTERPARTIES_SEARCH_MAX as presenterSearchMax,
} from "./counterparties-list.presenter";

function counterparty(
  overrides: Partial<CounterpartyListItem> = {},
): CounterpartyListItem {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "ФОП Кековченко І. В.",
    edrpou: "12345678",
    legalAddress: "м. Київ",
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
    notes: null,
    customerId: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
    customerName: "Іван Курбатов",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("listCounterpartiesPageInput", () => {
  it("omits search when empty and caps via the shared normalizer", () => {
    expect(presenterSearchMax).toBe(LIST_COUNTERPARTIES_SEARCH_MAX);
    expect(listCounterpartiesPageInput(undefined)).toEqual({});
    expect(listCounterpartiesPageInput("кеков")).toEqual({ search: "кеков" });
    expect(
      normalizeCustomersSearch("  12345678  ", LIST_COUNTERPARTIES_SEARCH_MAX),
    ).toBe("12345678");
  });
});

describe("toCounterpartyRowView", () => {
  it("maps legal name, edrpou, and live customerName when linked", () => {
    expect(toCounterpartyRowView(counterparty())).toEqual({
      id: "33333333-3333-4333-8333-333333333333",
      name: "ФОП Кековченко І. В.",
      edrpou: "12345678",
      customerId: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
      customerName: "Іван Курбатов",
    });
  });

  it("keeps standalone rows without a customer name", () => {
    expect(
      toCounterpartyRowView(
        counterparty({
          customerId: null,
          customerName: null,
          edrpou: null,
        }),
      ),
    ).toEqual({
      id: "33333333-3333-4333-8333-333333333333",
      name: "ФОП Кековченко І. В.",
      edrpou: null,
      customerId: null,
      customerName: null,
    });
  });
});

describe("classifyCounterpartiesList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    hasSearch: false,
  };

  it("splits loading, offline, search-empty, and catalog-empty", () => {
    expect(classifyCounterpartiesList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
    expect(
      classifyCounterpartiesList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(classifyCounterpartiesList({ ...base, hasSearch: true })).toEqual({
      kind: "empty-search",
    });
    expect(classifyCounterpartiesList(base)).toEqual({
      kind: "empty-catalog",
    });
    expect(classifyCounterpartiesList({ ...base, rowCount: 2 })).toEqual({
      kind: "rows",
    });
  });
});

describe("counterpartyRowActions", () => {
  it("hides edit and delete together — delete is customers:edit", () => {
    expect(counterpartyRowActions(false)).toEqual({
      showEdit: false,
      showDelete: false,
    });
    expect(counterpartyRowActions(true)).toEqual({
      showEdit: true,
      showDelete: true,
    });
  });
});
