import { describe, expect, it } from "vitest";

import { hierarchicalStackScreenOptions } from "./hierarchical-stack-options";

describe("hierarchicalStackScreenOptions", () => {
  it("enables V1 full-screen swipe-back on hierarchical pushes", () => {
    expect(hierarchicalStackScreenOptions).toEqual({
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
      animation: "slide_from_right",
      animationMatchesGesture: true,
    });
  });
});
