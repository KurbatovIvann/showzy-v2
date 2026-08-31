import { describe, expect, it } from "vitest";

import { optionSelectItems } from "../../../components/ui/option-select";
import { selectorLookupValue } from "./option-select";

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
