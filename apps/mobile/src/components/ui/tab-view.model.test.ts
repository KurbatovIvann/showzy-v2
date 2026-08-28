import { describe, expect, it } from "vitest";

import {
  indexOfTabKey,
  nextMountedIndices,
  resolveTabViewOptions,
} from "./tab-view.model";

describe("indexOfTabKey", () => {
  const tabs = [
    { key: "clients" },
    { key: "groups" },
    { key: "counterparties" },
    { key: "invitations" },
  ] as const;

  it("returns the pager index for a tab key", () => {
    expect(indexOfTabKey(tabs, "clients")).toBe(0);
    expect(indexOfTabKey(tabs, "groups")).toBe(1);
    expect(indexOfTabKey(tabs, "invitations")).toBe(3);
  });

  it("returns -1 when the key is missing", () => {
    expect(indexOfTabKey<string>([{ key: "clients" }], "groups")).toBe(-1);
  });
});

describe("nextMountedIndices", () => {
  it("keeps the same set when the page is already mounted", () => {
    const mounted = new Set([0]);
    expect(nextMountedIndices(mounted, 0)).toBe(mounted);
  });

  it("adds the first visit without mutating the previous set", () => {
    const mounted = new Set([0]);
    const next = nextMountedIndices(mounted, 2);
    expect(next).toEqual(new Set([0, 2]));
    expect(mounted).toEqual(new Set([0]));
  });
});

describe("resolveTabViewOptions", () => {
  it("defaults to swipe on, lazy off, first page, one offscreen", () => {
    expect(resolveTabViewOptions({})).toEqual({
      initialTabIndex: 0,
      swipeEnabled: true,
      lazy: false,
      offscreenPageLimit: 1,
      scrollableTabs: false,
    });
  });

  it("treats swipeEnabled={false} as disabled and other flags as on", () => {
    expect(
      resolveTabViewOptions({
        initialTabIndex: 2,
        swipeEnabled: false,
        lazy: true,
        offscreenPageLimit: 3,
        scrollableTabs: true,
      }),
    ).toEqual({
      initialTabIndex: 2,
      swipeEnabled: false,
      lazy: true,
      offscreenPageLimit: 3,
      scrollableTabs: true,
    });
  });
});
