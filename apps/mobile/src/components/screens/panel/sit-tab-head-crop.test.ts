import { describe, expect, it } from "vitest";

import {
  SIT_HEAD_FOCUS_X,
  SIT_HEAD_FOCUS_Y,
  SIT_TAB_HEAD_SCALE,
  sitTabHeadImageLayout,
} from "./sit-tab-head-crop";

describe("sitTabHeadImageLayout", () => {
  it("scales the sit mark past the tab circle and pins the head in the window", () => {
    expect(SIT_TAB_HEAD_SCALE).toBeGreaterThan(1);
    expect(SIT_HEAD_FOCUS_X).toBe(0.5);
    expect(SIT_HEAD_FOCUS_Y).toBeLessThan(0.5);

    const circleSize = 44;
    const layout = sitTabHeadImageLayout(circleSize);
    expect(layout.position).toBe("absolute");
    expect(layout.width).toBe(circleSize * SIT_TAB_HEAD_SCALE);
    expect(layout.height).toBe(layout.width);
    expect(layout.width).toBeGreaterThan(circleSize);
    expect(layout.left).toBeLessThan(0);
    expect(layout.top + layout.height).toBeGreaterThan(circleSize);
    expect(layout.top).toBeCloseTo(
      circleSize / 2 - SIT_HEAD_FOCUS_Y * layout.width,
    );
    expect(layout.left).toBeCloseTo(
      circleSize / 2 - SIT_HEAD_FOCUS_X * layout.width,
    );
  });
});
