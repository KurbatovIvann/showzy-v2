import { describe, expect, it } from "vitest";

import {
  filterOptionSelectItems,
  flattenPages,
  optionSelectItems,
} from "../../../components/ui/option-select";
import { shouldDrainNextPage } from "../../../hooks/drain-pages";

describe("optionSelectItems / filterOptionSelectItems", () => {
  it("maps names and filters by name or description", () => {
    const options = optionSelectItems([
      { id: "a", name: "#12", description: "1 200 ₴" },
      { id: "b", name: "#13", description: null },
    ]);
    expect(options).toEqual([
      { id: "a", name: "#12", description: "1 200 ₴" },
      { id: "b", name: "#13" },
    ]);
    expect(filterOptionSelectItems(options, "12")).toEqual([options[0]]);
    expect(filterOptionSelectItems(options, "200")).toEqual([options[0]]);
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
