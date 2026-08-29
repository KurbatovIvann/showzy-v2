import { describe, expect, it } from "vitest";

import {
  counterpartiesBodyCopy,
  counterpartiesBodyKind,
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
} from "./customer-form-pickers";

describe("groupAssignedPriceListId", () => {
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
  it("is save-first on create and list-or-empty on edit", () => {
    expect(
      counterpartiesBodyKind({
        mode: "create",
        status: "success",
        itemCount: 3,
      }),
    ).toBe("create-hint");
    expect(
      counterpartiesBodyKind({
        mode: "edit",
        status: "pending",
        itemCount: 0,
      }),
    ).toBe("loading");
    expect(
      counterpartiesBodyKind({
        mode: "edit",
        status: "error",
        itemCount: 0,
      }),
    ).toBe("error");
    expect(
      counterpartiesBodyKind({
        mode: "edit",
        status: "success",
        itemCount: 0,
      }),
    ).toBe("empty");
    expect(
      counterpartiesBodyKind({
        mode: "edit",
        status: "success",
        itemCount: 2,
      }),
    ).toBe("list");
    expect(
      counterpartiesBodyCopy({
        kind: "create-hint",
        createHint: "save first",
        empty: "none",
        error: "failed",
      }),
    ).toBe("save first");
    expect(
      counterpartiesBodyCopy({
        kind: "list",
        createHint: "save first",
        empty: "none",
        error: "failed",
      }),
    ).toBeNull();
    expect(
      counterpartiesBodyCopy({
        kind: "error",
        createHint: "save first",
        empty: "none",
        error: "failed",
      }),
    ).toBe("failed");
  });
});
