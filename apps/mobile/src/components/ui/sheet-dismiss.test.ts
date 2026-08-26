import { describe, expect, it } from "vitest";

import {
  SHEET_MS,
  sheetDismissTimeoutMs,
  sheetDismissWaitMs,
} from "./sheet-dismiss";

describe("sheet dismiss timing", () => {
  it("waits longer than the close animation so iOS can drop the Modal window", () => {
    expect(sheetDismissTimeoutMs()).toBeGreaterThan(SHEET_MS);
    expect(sheetDismissWaitMs()).toBeGreaterThan(sheetDismissTimeoutMs());
  });
});
