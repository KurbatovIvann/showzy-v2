import { describe, expect, it } from "vitest";

import { filterOptionSelectItems } from "./option-select";

const OPTIONS = [
  { id: "a", name: "Опт", description: "Default" },
  { id: "b", name: "Роздріб" },
  { id: "c", name: "VIP" },
] as const;

describe("filterOptionSelectItems", () => {
  it("returns every option when the query is blank", () => {
    expect(filterOptionSelectItems(OPTIONS, "  ")).toEqual(OPTIONS);
  });

  it("matches name case-insensitively and ignores description", () => {
    expect(filterOptionSelectItems(OPTIONS, "оп")).toEqual([OPTIONS[0]]);
    expect(filterOptionSelectItems(OPTIONS, "default")).toEqual([]);
  });
});
