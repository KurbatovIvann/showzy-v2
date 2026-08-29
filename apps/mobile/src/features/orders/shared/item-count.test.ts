import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "./item-count";

describe("itemCountLabel", () => {
  it("uses Ukrainian one/few/many cardinals", () => {
    const forms = ordersCopy("uk").items;
    expect(itemCountLabel(1, "uk", forms)).toBe("1 позиція");
    expect(itemCountLabel(2, "uk", forms)).toBe("2 позиції");
    expect(itemCountLabel(5, "uk", forms)).toBe("5 позицій");
    expect(itemCountLabel(21, "uk", forms)).toBe("21 позиція");
  });

  it("uses English one/other", () => {
    const forms = ordersCopy("en").items;
    expect(itemCountLabel(1, "en", forms)).toBe("1 item");
    expect(itemCountLabel(2, "en", forms)).toBe("2 items");
  });
});
