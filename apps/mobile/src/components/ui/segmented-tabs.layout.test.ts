import { describe, expect, it } from "vitest";

import { scrollXToRevealTab } from "./segmented-tabs.layout";

describe("scrollXToRevealTab", () => {
  it("stays at zero when the track fits the viewport", () => {
    expect(
      scrollXToRevealTab({
        tabX: 40,
        tabWidth: 80,
        viewportWidth: 320,
        contentWidth: 280,
        gutter: 8,
      }),
    ).toBe(0);
  });

  it("aligns a later tab to the left gutter and clamps to max scroll", () => {
    expect(
      scrollXToRevealTab({
        tabX: 200,
        tabWidth: 90,
        viewportWidth: 200,
        contentWidth: 400,
        gutter: 8,
      }),
    ).toBe(192);
    expect(
      scrollXToRevealTab({
        tabX: 0,
        tabWidth: 80,
        viewportWidth: 200,
        contentWidth: 400,
        gutter: 8,
      }),
    ).toBe(0);
    expect(
      scrollXToRevealTab({
        tabX: 380,
        tabWidth: 80,
        viewportWidth: 200,
        contentWidth: 400,
        gutter: 8,
      }),
    ).toBe(200);
  });
});
