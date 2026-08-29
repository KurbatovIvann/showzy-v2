import { describe, expect, it } from "vitest";

import {
  filterOptionSelectItems,
  optionSelectItems,
  selectorLookupValue,
} from "./option-select";

const OPTIONS = [
  { id: "a", name: "Опт", description: "Default" },
  { id: "b", name: "Роздріб" },
  { id: "c", name: "VIP" },
] as const;

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

describe("selectorLookupValue", () => {
  it("uses inherit (undefined) only for a null id, not an unnamed assignment", () => {
    const names = new Map([["g1", "VIP"]]);
    expect(selectorLookupValue(null, names, "Assigned")).toBeUndefined();
    expect(selectorLookupValue("g1", names, "Assigned")).toBe("VIP");
    expect(selectorLookupValue("missing", names, "Assigned")).toBe("Assigned");
  });
});

describe("filterOptionSelectItems", () => {
  it("returns every option when the query is blank", () => {
    expect(filterOptionSelectItems(OPTIONS, "  ")).toEqual(OPTIONS);
  });

  it("matches name case-insensitively and ignores description", () => {
    expect(filterOptionSelectItems(OPTIONS, "оп")).toEqual([OPTIONS[0]]);
    expect(filterOptionSelectItems(OPTIONS, "default")).toEqual([]);
  });
});
