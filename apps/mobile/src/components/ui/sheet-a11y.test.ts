import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const UI_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(UI_DIR, "../..");

function listTsx(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsx(path));
      continue;
    }
    if (entry.name.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

describe("Sheet always exposes a dismiss control", () => {
  it("renders the close Pressable without gating on an optional label", () => {
    const source = readFileSync(join(UI_DIR, "sheet.tsx"), "utf8");
    expect(source).toContain("closeAccessibilityLabel: string");
    expect(source).not.toContain("closeAccessibilityLabel?:");
    expect(source).toContain("<SheetHeader");
    expect(source).toContain("useSheetPresentation(");
    expect(source).toContain(
      "accessibilityLabel={props.closeAccessibilityLabel}",
    );
    expect(source).not.toContain("closeLabel !== null");
  });

  it("passes closeAccessibilityLabel at every Sheet call site", () => {
    const missing: string[] = [];
    for (const file of listTsx(SRC_DIR)) {
      if (file.endsWith(`${join("components", "ui", "sheet.tsx")}`)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (!/<Sheet\b/.test(source)) {
        continue;
      }
      if (!source.includes("closeAccessibilityLabel=")) {
        missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });
});
