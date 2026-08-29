import { describe, expect, it } from "vitest";

import {
  filterOptionSelectItems,
  flattenPages,
  optionSelectItems,
  shouldDrainNextPage,
} from "./option-select";

describe("optionSelectItems / filterOptionSelectItems", () => {
  it("maps names and filters by name or description", () => {
    const options = optionSelectItems([
      { id: "a", name: "Марія", description: "+38067" },
      { id: "b", name: "Олег", description: null },
    ]);
    expect(options).toEqual([
      { id: "a", name: "Марія", description: "+38067" },
      { id: "b", name: "Олег" },
    ]);
    expect(filterOptionSelectItems(options, "мар")).toEqual([options[0]]);
    expect(filterOptionSelectItems(options, "380")).toEqual([options[0]]);
    expect(filterOptionSelectItems(options, "")).toEqual(options);
  });
});

describe("flattenPages / shouldDrainNextPage", () => {
  it("concatenates pages and drains only a successful next page", () => {
    expect(flattenPages([{ items: [1, 2] }, { items: [3] }])).toEqual([
      1, 2, 3,
    ]);
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    ).toBe(false);
  });
});
