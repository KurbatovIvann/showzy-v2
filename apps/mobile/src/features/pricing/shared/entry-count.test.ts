import { describe, expect, it } from "vitest";

import { pricingCopy } from "../../../i18n/pricing";
import { entryCountLabel } from "./entry-count";

describe("entryCountLabel", () => {
  it("uses Ukrainian one/few/many including the canvas zero form", () => {
    const forms = pricingCopy("uk").prices;
    expect(entryCountLabel(0, "uk", forms)).toBe("Без окремих цін");
    expect(entryCountLabel(1, "uk", forms)).toBe("1 ціна");
    expect(entryCountLabel(2, "uk", forms)).toBe("2 ціни");
    expect(entryCountLabel(3, "uk", forms)).toBe("3 ціни");
    expect(entryCountLabel(4, "uk", forms)).toBe("4 ціни");
    expect(entryCountLabel(5, "uk", forms)).toBe("5 цін");
    expect(entryCountLabel(11, "uk", forms)).toBe("11 цін");
    expect(entryCountLabel(21, "uk", forms)).toBe("21 ціна");
  });

  it("uses English one/other and the canvas zero form", () => {
    const forms = pricingCopy("en").prices;
    expect(entryCountLabel(0, "en", forms)).toBe("No separate prices");
    expect(entryCountLabel(1, "en", forms)).toBe("1 price");
    expect(entryCountLabel(4, "en", forms)).toBe("4 prices");
  });
});
