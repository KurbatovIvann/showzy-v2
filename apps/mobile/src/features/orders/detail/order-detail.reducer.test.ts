import { describe, expect, it } from "vitest";

import {
  IDLE_DETAIL_SHEETS,
  orderDetailSheetChrome,
  reduceOrderDetailSheets,
} from "./order-detail.reducer";

describe("reduceOrderDetailSheets", () => {
  it("opens and closes the actions sheet", () => {
    const open = reduceOrderDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openActions",
    });
    expect(orderDetailSheetChrome(open).actionsVisible).toBe(true);
    expect(reduceOrderDetailSheets(open, { type: "closeAll" })).toEqual(
      IDLE_DETAIL_SHEETS,
    );
  });
});
