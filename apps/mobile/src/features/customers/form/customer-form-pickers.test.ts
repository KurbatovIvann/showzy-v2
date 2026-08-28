import { describe, expect, it } from "vitest";

import {
  counterpartiesBodyCopy,
  counterpartiesBodyKind,
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
  namedLookupValue,
  optionSelectItems,
  shouldDrainLookupPages,
} from "./customer-form-pickers";

describe("optionSelectItems", () => {
  it("drops blank descriptions", () => {
    expect(
      optionSelectItems([
        { id: "a", name: "Опт", description: "Для гурту" },
        { id: "b", name: "VIP", description: null },
      ]),
    ).toEqual([
      { id: "a", name: "Опт", description: "Для гурту" },
      { id: "b", name: "VIP" },
    ]);
  });
});

describe("namedLookupValue / groupAssignedPriceListId", () => {
  it("returns undefined when the id is missing from the lookup", () => {
    const names = new Map([["g1", "VIP"]]);
    expect(namedLookupValue(null, names)).toBeUndefined();
    expect(namedLookupValue("g1", names)).toBe("VIP");
    expect(namedLookupValue("missing", names)).toBeUndefined();
  });

  it("reads the group's assigned price list for inherit copy", () => {
    const byGroup = new Map<string, string | null>([
      ["g1", "pl-1"],
      ["g2", null],
    ]);
    expect(groupAssignedPriceListId("g1", byGroup)).toBe("pl-1");
    expect(groupAssignedPriceListId("g2", byGroup)).toBeNull();
    expect(groupAssignedPriceListId(null, byGroup)).toBeNull();
    expect(groupAssignedPriceListId("missing", byGroup)).toBeNull();
  });
});

describe("inheritedPriceListPlaceholder", () => {
  it("uses group inherit copy when the selected group has a price list", () => {
    expect(
      inheritedPriceListPlaceholder({
        groupPriceListId: "pl-1",
        inheritGroup: "Успадкований від групи",
        retailDefault: "Роздрібний за замовчуванням",
      }),
    ).toBe("Успадкований від групи");
    expect(
      inheritedPriceListPlaceholder({
        groupPriceListId: null,
        inheritGroup: "Успадкований від групи",
        retailDefault: "Роздрібний за замовчуванням",
      }),
    ).toBe("Роздрібний за замовчуванням");
  });
});

describe("counterpartiesBodyKind", () => {
  it("is save-first on create and count-or-empty on edit", () => {
    expect(counterpartiesBodyKind("create", 3)).toBe("create-hint");
    expect(counterpartiesBodyKind("edit", 0)).toBe("empty");
    expect(counterpartiesBodyKind("edit", 2)).toBe("count");
    expect(
      counterpartiesBodyCopy({
        kind: "create-hint",
        createHint: "save first",
        empty: "none",
        countLabel: "2 counterparties",
      }),
    ).toBe("save first");
    expect(
      counterpartiesBodyCopy({
        kind: "count",
        createHint: "save first",
        empty: "none",
        countLabel: "2 counterparties",
      }),
    ).toBe("2 counterparties");
  });
});

describe("shouldDrainLookupPages", () => {
  it("fetches the next page only after a successful page", () => {
    expect(
      shouldDrainLookupPages({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
    expect(
      shouldDrainLookupPages({
        status: "error",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
  });
});
