import { describe, expect, it } from "vitest";

import {
  DECIMAL_QUANTITY_MESSAGE,
  decimalQuantityToMilli,
  quantityInputToMilli,
} from "./quantity.js";

describe("quantityInputToMilli", () => {
  it("keeps milli and converts decimal at scale 3", () => {
    expect(quantityInputToMilli({ milli: "1500" })).toBe("1500");
    expect(decimalQuantityToMilli("1.5")).toBe(1500n);
    expect(quantityInputToMilli({ decimal: "1.5" })).toBe("1500");
    expect(quantityInputToMilli({ decimal: "1" })).toBe("1000");
    expect(quantityInputToMilli({ decimal: "0.001" })).toBe("1");
    expect(DECIMAL_QUANTITY_MESSAGE.length).toBeGreaterThan(0);
  });
});
