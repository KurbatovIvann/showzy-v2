import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./segmented-tabs.tsx", import.meta.url),
  "utf8",
);

describe("SegmentedTabs scroll reveal", () => {
  it("dedupes the scroll-reveal blocks through reveal()", () => {
    expect(SOURCE).toContain("reveal(props.selected)");
    expect(SOURCE).toContain("const reveal = useCallback");
    expect(SOURCE.match(/scrollRef\.current\?\.scrollTo/g)).toEqual([
      "scrollRef.current?.scrollTo",
    ]);
  });
});
