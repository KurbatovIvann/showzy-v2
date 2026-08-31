import { describe, expect, it } from "vitest";

import { uniqueIds } from "./unique-ids.js";

describe("uniqueIds", () => {
  it("preserves first-seen order and drops later duplicates", () => {
    expect(uniqueIds(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });

  it("returns a new empty array for no ids", () => {
    expect(uniqueIds([])).toEqual([]);
  });
});
