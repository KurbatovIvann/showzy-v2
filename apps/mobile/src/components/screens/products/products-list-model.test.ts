import { describe, expect, it } from "vitest";

import {
  classifyProductsList,
  flattenProductPages,
  listProductsPageInput,
  mergeDownloadUrlPages,
  normalizeProductsSearch,
  productsProbeState,
  toProductRowView,
  uniquePrimaryImageFileIds,
  PRODUCTS_SEARCH_MAX_LENGTH,
} from "./products-list-model";
import type { ProductListItem } from "./products-list-query";

function item(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
    name: "Торт «Київський»",
    basePriceMinor: "123456",
    currency: "UAH",
    status: "active",
    variantCount: 2,
    primaryImageFileId: null,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeProductsSearch", () => {
  it("treats empty and whitespace-only input as no search", () => {
    expect(normalizeProductsSearch("")).toBeUndefined();
    expect(normalizeProductsSearch("   ")).toBeUndefined();
  });

  it("trims and caps at the contract query length", () => {
    expect(normalizeProductsSearch("  торт  ")).toBe("торт");
    const long = "a".repeat(PRODUCTS_SEARCH_MAX_LENGTH + 20);
    expect(normalizeProductsSearch(long)).toHaveLength(
      PRODUCTS_SEARCH_MAX_LENGTH,
    );
  });
});

describe("listProductsPageInput", () => {
  it("omits the query key entirely when there is no search", () => {
    expect(listProductsPageInput("active", undefined)).toEqual({
      status: "active",
    });
    expect(listProductsPageInput("archived", "торт")).toEqual({
      status: "archived",
      query: "торт",
    });
  });
});

describe("flattenProductPages", () => {
  it("concatenates page items in order", () => {
    const first = item({ id: "11111111-1111-4111-8111-111111111111" });
    const second = item({ id: "22222222-2222-4222-8222-222222222222" });
    const third = item({ id: "33333333-3333-4333-8333-333333333333" });
    expect(
      flattenProductPages([{ items: [first, second] }, { items: [third] }]),
    ).toEqual([first, second, third]);
  });
});

describe("uniquePrimaryImageFileIds", () => {
  it("skips nulls and duplicates, keeping first-seen order", () => {
    const shared = "44444444-4444-4444-8444-444444444444";
    const other = "55555555-5555-4555-8555-555555555555";
    expect(
      uniquePrimaryImageFileIds([
        item({ primaryImageFileId: null }),
        item({ primaryImageFileId: shared }),
        item({ primaryImageFileId: other }),
        item({ primaryImageFileId: shared }),
        item({ primaryImageFileId: null }),
      ]),
    ).toEqual([shared, other]);
  });
});

describe("mergeDownloadUrlPages", () => {
  it("ignores pending pages and last write wins for a repeated fileId", () => {
    const first = "44444444-4444-4444-8444-444444444444";
    const second = "55555555-5555-4555-8555-555555555555";
    const merged = mergeDownloadUrlPages([
      undefined,
      {
        files: [
          { fileId: first, downloadUrl: "https://example.test/a" },
          { fileId: second, downloadUrl: "https://example.test/b" },
        ],
      },
      {
        files: [{ fileId: first, downloadUrl: "https://example.test/a2" }],
      },
    ]);
    expect(merged.get(first)).toBe("https://example.test/a2");
    expect(merged.get(second)).toBe("https://example.test/b");
    expect(merged.get("missing")).toBeUndefined();
  });
});

describe("toProductRowView", () => {
  it("maps a contract row onto row-view primitives", () => {
    const view = toProductRowView(
      item({
        status: "archived",
        variantCount: 3,
        primaryImageFileId: "44444444-4444-4444-8444-444444444444",
      }),
    );
    expect(view).toEqual({
      id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
      name: "Торт «Київський»",
      priceLabel: "1\u00A0234,56\u00A0₴",
      archived: true,
      variantCount: 3,
      primaryImageFileId: "44444444-4444-4444-8444-444444444444",
    });
  });
});

describe("productsProbeState", () => {
  it("is idle while disabled and loading until the probe resolves", () => {
    expect(
      productsProbeState({
        enabled: false,
        status: "pending",
        itemCount: undefined,
      }),
    ).toBe("idle");
    expect(
      productsProbeState({
        enabled: true,
        status: "pending",
        itemCount: undefined,
      }),
    ).toBe("loading");
  });

  it("reports emptiness from the one-row page", () => {
    expect(
      productsProbeState({ enabled: true, status: "success", itemCount: 0 }),
    ).toBe("empty");
    expect(
      productsProbeState({ enabled: true, status: "success", itemCount: 1 }),
    ).toBe("nonempty");
    expect(
      productsProbeState({
        enabled: true,
        status: "error",
        itemCount: undefined,
      }),
    ).toBe("error");
  });
});

describe("classifyProductsList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    hasSearch: false,
    filter: "active" as const,
    probe: "empty" as const,
  };

  it("is an error when the client is not ready", () => {
    expect(classifyProductsList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the list query is pending", () => {
    expect(classifyProductsList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline from other failures", () => {
    expect(
      classifyProductsList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyProductsList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows rows whenever any are loaded", () => {
    expect(classifyProductsList({ ...base, rowCount: 3 })).toEqual({
      kind: "rows",
    });
  });

  it("prefers the search empty state over filter empty states", () => {
    expect(
      classifyProductsList({ ...base, hasSearch: true, filter: "archived" }),
    ).toEqual({ kind: "empty-search" });
  });

  it("maps archived and all filters to their empty states", () => {
    expect(classifyProductsList({ ...base, filter: "archived" })).toEqual({
      kind: "empty-archived",
    });
    expect(classifyProductsList({ ...base, filter: "all" })).toEqual({
      kind: "empty-catalog",
    });
  });

  it("consults the probe for an empty active filter", () => {
    expect(classifyProductsList({ ...base, probe: "loading" })).toEqual({
      kind: "loading",
    });
    expect(classifyProductsList({ ...base, probe: "idle" })).toEqual({
      kind: "loading",
    });
    expect(classifyProductsList({ ...base, probe: "empty" })).toEqual({
      kind: "empty-catalog",
    });
    expect(classifyProductsList({ ...base, probe: "nonempty" })).toEqual({
      kind: "empty-active",
    });
    expect(classifyProductsList({ ...base, probe: "error" })).toEqual({
      kind: "empty-catalog",
    });
  });
});
