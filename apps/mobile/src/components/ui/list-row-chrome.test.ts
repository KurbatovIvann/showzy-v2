import { describe, expect, it } from "vitest";

import { listRowChrome } from "./list-row-chrome";

describe("listRowChrome", () => {
  it("draws a hairline on every row except the first", () => {
    expect(listRowChrome({}).showDivider).toBe(true);
    expect(listRowChrome({ first: false }).showDivider).toBe(true);
    expect(listRowChrome({ first: true }).showDivider).toBe(false);
  });

  it("treats provisional as unused visual chrome only", () => {
    expect(listRowChrome({}).provisional).toBe(false);
    expect(listRowChrome({ provisional: true }).provisional).toBe(true);
    expect(listRowChrome({ first: true, provisional: true })).toEqual({
      showDivider: false,
      provisional: true,
    });
  });
});
