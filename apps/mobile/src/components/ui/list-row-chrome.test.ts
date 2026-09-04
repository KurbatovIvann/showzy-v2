import { describe, expect, it } from "vitest";

import { listGroupEdge, listRowChrome } from "./list-row-chrome";

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
      groupEdge: null,
    });
  });

  it("skips the hairline on grouped start and only edges", () => {
    expect(listRowChrome({ groupEdge: "start" })).toEqual({
      showDivider: false,
      provisional: false,
      groupEdge: "start",
    });
    expect(listRowChrome({ groupEdge: "only" }).showDivider).toBe(false);
    expect(listRowChrome({ groupEdge: "middle" }).showDivider).toBe(true);
    expect(listRowChrome({ groupEdge: "end" }).showDivider).toBe(true);
  });
});

describe("listGroupEdge", () => {
  it("returns null for an empty list or an out-of-range index", () => {
    expect(listGroupEdge(0, 0)).toBeNull();
    expect(listGroupEdge(-1, 2)).toBeNull();
    expect(listGroupEdge(2, 2)).toBeNull();
  });

  it("marks a single row as only and splits longer lists into start/middle/end", () => {
    expect(listGroupEdge(0, 1)).toBe("only");
    expect(listGroupEdge(0, 3)).toBe("start");
    expect(listGroupEdge(1, 3)).toBe("middle");
    expect(listGroupEdge(2, 3)).toBe("end");
  });
});
