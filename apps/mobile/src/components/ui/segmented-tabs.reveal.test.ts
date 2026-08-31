import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "segmented-tabs.tsx"),
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
