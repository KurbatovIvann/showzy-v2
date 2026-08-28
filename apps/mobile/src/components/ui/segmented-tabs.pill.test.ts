import { describe, expect, it } from "vitest";

import {
  segmentedPillLayoutMove,
  shouldSnapSegmentedPill,
} from "./segmented-tabs.pill";

describe("shouldSnapSegmentedPill", () => {
  it("snaps before the pill has been placed", () => {
    expect(
      shouldSnapSegmentedPill({
        placed: false,
        reduceMotion: false,
        reason: "select",
      }),
    ).toBe(true);
  });

  it("snaps when the OS asks for reduced motion", () => {
    expect(
      shouldSnapSegmentedPill({
        placed: true,
        reduceMotion: true,
        reason: "select",
      }),
    ).toBe(true);
  });

  it("snaps on layout so a resize does not ease the pill", () => {
    expect(
      shouldSnapSegmentedPill({
        placed: true,
        reduceMotion: false,
        reason: "layout",
      }),
    ).toBe(true);
  });

  it("animates when the selected tab changes", () => {
    expect(
      shouldSnapSegmentedPill({
        placed: true,
        reduceMotion: false,
        reason: "select",
      }),
    ).toBe(false);
  });
});

describe("segmentedPillLayoutMove", () => {
  const box = { x: 40, width: 80 };

  it("ignores layout for a tab that is not selected", () => {
    expect(
      segmentedPillLayoutMove({
        isSelected: false,
        placed: true,
        prev: box,
        next: { x: 120, width: 90 },
      }),
    ).toBeNull();
  });

  it("snaps the first measure of the selected tab", () => {
    expect(
      segmentedPillLayoutMove({
        isSelected: true,
        placed: false,
        prev: undefined,
        next: box,
      }),
    ).toBe("layout");
  });

  it("animates when the newly selected tab is measured for the first time", () => {
    expect(
      segmentedPillLayoutMove({
        isSelected: true,
        placed: true,
        prev: undefined,
        next: { x: 200, width: 96 },
      }),
    ).toBe("select");
  });

  it("ignores a restyle that does not move the selected tab", () => {
    expect(
      segmentedPillLayoutMove({
        isSelected: true,
        placed: true,
        prev: box,
        next: box,
      }),
    ).toBeNull();
  });

  it("snaps when the selected tab actually resizes", () => {
    expect(
      segmentedPillLayoutMove({
        isSelected: true,
        placed: true,
        prev: box,
        next: { x: 40, width: 120 },
      }),
    ).toBe("layout");
  });
});
