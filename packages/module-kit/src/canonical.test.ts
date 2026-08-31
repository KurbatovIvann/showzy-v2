import { describe, expect, it } from "vitest";

import { moneyFromCanonical, moneyToCanonical } from "./canonical.js";

describe("canonical money", () => {
  it("round-trips signed int64-range values as decimal strings", () => {
    for (const minor of [
      0n,
      1n,
      -1n,
      199n,
      9223372036854775807n,
      -9223372036854775808n,
    ]) {
      const encoded = moneyToCanonical(minor);
      expect(encoded).toBe(minor.toString(10));
      expect(moneyFromCanonical(encoded)).toBe(minor);
    }
  });
});
