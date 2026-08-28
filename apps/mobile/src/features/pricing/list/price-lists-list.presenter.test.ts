import { describe, expect, it } from "vitest";

import type { PriceListItem } from "../api/price-list.queries";
import { LIST_PRICE_LISTS_QUERY_MAX } from "../shared/price-list-caps";
import {
  classifyPriceListsList,
  flattenPriceListPages,
  listPriceListsPageInput,
  normalizePriceListsSearch,
  priceListOptionVisibility,
  priceListRowActions,
  shouldBlockDeactivateDefault,
  shouldShowPriceListsHint,
  toPriceListRowView,
  LIST_PRICE_LISTS_QUERY_MAX as presenterSearchMax,
} from "./price-lists-list.presenter";

function item(overrides: Partial<PriceListItem> = {}): PriceListItem {
  return {
    id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
    name: "Опт",
    isDefault: false,
    isActive: true,
    entryCount: 3,
    ...overrides,
  };
}

describe("normalizePriceListsSearch", () => {
  it("treats empty and whitespace-only input as no search", () => {
    expect(normalizePriceListsSearch("")).toBeUndefined();
    expect(normalizePriceListsSearch("   ")).toBeUndefined();
  });

  it("trims and caps at the listPriceLists query max, not a local literal", () => {
    expect(presenterSearchMax).toBe(LIST_PRICE_LISTS_QUERY_MAX);
    expect(normalizePriceListsSearch("  опт  ")).toBe("опт");
    const long = "a".repeat(LIST_PRICE_LISTS_QUERY_MAX + 20);
    expect(normalizePriceListsSearch(long)).toHaveLength(
      LIST_PRICE_LISTS_QUERY_MAX,
    );
  });
});

describe("listPriceListsPageInput", () => {
  it("maps availability chips onto the server availability field", () => {
    expect(listPriceListsPageInput("all", undefined)).toEqual({
      availability: "all",
    });
    expect(listPriceListsPageInput("active", undefined)).toEqual({
      availability: "active",
    });
    expect(listPriceListsPageInput("inactive", "опт")).toEqual({
      availability: "inactive",
      query: "опт",
    });
  });

  it("omits the query key entirely when there is no search", () => {
    expect(listPriceListsPageInput("all", undefined)).not.toHaveProperty(
      "query",
    );
  });
});

describe("flattenPriceListPages", () => {
  it("concatenates page items in order", () => {
    const first = item({ id: "11111111-1111-4111-8111-111111111111" });
    const second = item({ id: "22222222-2222-4222-8222-222222222222" });
    expect(
      flattenPriceListPages([{ items: [first] }, { items: [second] }]),
    ).toEqual([first, second]);
  });
});

describe("toPriceListRowView", () => {
  it("maps a contract row onto primitives and omits assignment counts", () => {
    const view = toPriceListRowView(
      item({ isDefault: true, isActive: false, entryCount: 0 }),
    );
    expect(view).toEqual({
      id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
      name: "Опт",
      isDefault: true,
      isActive: false,
      entryCount: 0,
    });
    expect(view).not.toHaveProperty("assignmentCount");
    expect(view).not.toHaveProperty("description");
  });
});

describe("classifyPriceListsList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    hasSearch: false,
    availability: "all" as const,
  };

  it("is an error when the client is not ready", () => {
    expect(classifyPriceListsList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the list query is pending", () => {
    expect(classifyPriceListsList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline from other failures", () => {
    expect(
      classifyPriceListsList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyPriceListsList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows rows whenever any are loaded", () => {
    expect(classifyPriceListsList({ ...base, rowCount: 3 })).toEqual({
      kind: "rows",
    });
  });

  it("maps search and availability chips other than all to filtered-empty", () => {
    expect(
      classifyPriceListsList({ ...base, hasSearch: true, availability: "all" }),
    ).toEqual({ kind: "empty-filtered" });
    expect(classifyPriceListsList({ ...base, availability: "active" })).toEqual(
      { kind: "empty-filtered" },
    );
    expect(
      classifyPriceListsList({ ...base, availability: "inactive" }),
    ).toEqual({ kind: "empty-filtered" });
  });

  it("maps an unfiltered empty page to catalog-empty", () => {
    expect(classifyPriceListsList(base)).toEqual({ kind: "empty-catalog" });
  });
});

describe("priceListRowActions", () => {
  it("hides edit and options without pricing:manage", () => {
    expect(priceListRowActions({ canManage: false })).toEqual({
      showEdit: false,
      showOptions: false,
    });
    expect(priceListRowActions({ canManage: true })).toEqual({
      showEdit: true,
      showOptions: true,
    });
  });
});

describe("priceListOptionVisibility", () => {
  it("hides every write option without pricing:manage", () => {
    expect(
      priceListOptionVisibility({
        canManage: false,
        isDefault: true,
        isActive: true,
      }),
    ).toEqual({
      showSetDefault: false,
      showClearDefault: false,
      showActivate: false,
      showDeactivate: false,
      showDelete: false,
      deactivateBlocked: true,
    });
  });

  it("shows set-default and deactivate on a non-default active list", () => {
    expect(
      priceListOptionVisibility({
        canManage: true,
        isDefault: false,
        isActive: true,
      }),
    ).toEqual({
      showSetDefault: true,
      showClearDefault: false,
      showActivate: false,
      showDeactivate: true,
      showDelete: true,
      deactivateBlocked: false,
    });
  });

  it("shows clear-default and blocks deactivate on the default active list", () => {
    expect(
      priceListOptionVisibility({
        canManage: true,
        isDefault: true,
        isActive: true,
      }),
    ).toEqual({
      showSetDefault: false,
      showClearDefault: true,
      showActivate: false,
      showDeactivate: true,
      showDelete: true,
      deactivateBlocked: true,
    });
  });

  it("shows activate on an inactive list", () => {
    expect(
      priceListOptionVisibility({
        canManage: true,
        isDefault: false,
        isActive: false,
      }),
    ).toEqual({
      showSetDefault: true,
      showClearDefault: false,
      showActivate: true,
      showDeactivate: false,
      showDelete: true,
      deactivateBlocked: false,
    });
  });
});

describe("shouldBlockDeactivateDefault", () => {
  it("blocks only the default-and-active combination", () => {
    expect(
      shouldBlockDeactivateDefault({ isDefault: true, isActive: true }),
    ).toBe(true);
    expect(
      shouldBlockDeactivateDefault({ isDefault: true, isActive: false }),
    ).toBe(false);
    expect(
      shouldBlockDeactivateDefault({ isDefault: false, isActive: true }),
    ).toBe(false);
  });
});

describe("shouldShowPriceListsHint", () => {
  it("shows the canvas dashed hint when fewer than four unfiltered lists are loaded", () => {
    expect(
      shouldShowPriceListsHint({
        rowCount: 3,
        hasNextPage: false,
        hasSearch: false,
        availability: "all",
      }),
    ).toBe(true);
    expect(
      shouldShowPriceListsHint({
        rowCount: 4,
        hasNextPage: false,
        hasSearch: false,
        availability: "all",
      }),
    ).toBe(false);
    expect(
      shouldShowPriceListsHint({
        rowCount: 2,
        hasNextPage: true,
        hasSearch: false,
        availability: "all",
      }),
    ).toBe(false);
    expect(
      shouldShowPriceListsHint({
        rowCount: 0,
        hasNextPage: false,
        hasSearch: false,
        availability: "all",
      }),
    ).toBe(false);
  });

  it("hides the hint when search or availability chips are filtering", () => {
    expect(
      shouldShowPriceListsHint({
        rowCount: 2,
        hasNextPage: false,
        hasSearch: true,
        availability: "all",
      }),
    ).toBe(false);
    expect(
      shouldShowPriceListsHint({
        rowCount: 2,
        hasNextPage: false,
        hasSearch: false,
        availability: "active",
      }),
    ).toBe(false);
  });
});
