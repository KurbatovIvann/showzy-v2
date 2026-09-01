import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("AI tab route (SHO-323)", () => {
  it("re-exports AssistantSheetScreen and does not mount the placeholder", () => {
    const route = readFileSync(
      join(here, "../src/app/(app)/(tabs)/ai.tsx"),
      "utf8",
    );
    expect(route).toContain("AssistantSheetScreen");
    expect(route).toContain("export { AssistantSheetScreen as default }");
    expect(route).not.toContain("AiPlaceholderScreen");
    expect(route).not.toContain("panel-placeholder-screen");
  });
});
