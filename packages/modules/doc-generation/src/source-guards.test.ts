import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "../../../..");

const FORBIDDEN_CALENDAR =
  /\.getFullYear\s*\(|\.getUTCFullYear\s*\(|extract\s*\(\s*year|date-fns/;

const FORBIDDEN_DEPS = /puppeteer|chromium|playwright|platejs|@plate/;

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

function executableSource(relative: string): string {
  return readSrc(relative)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

describe("doc-generation source guards (SHO-236)", () => {
  it("does not recompute issuedOn with Date year APIs or date-fns", () => {
    const sources = [
      "actions/render-pdf.ts",
      "services/render-pdf.ts",
      "services/format-pdf-text.ts",
      "templates/document-pdf.tsx",
      "templates/render-document.ts",
    ];
    for (const relative of sources) {
      expect(executableSource(relative), relative).not.toMatch(
        FORBIDDEN_CALENDAR,
      );
    }
  });

  it("pins @react-pdf/renderer exactly and does not add Puppeteer", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "../package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@react-pdf/renderer"]).toBe("4.9.0");
    expect(JSON.stringify(pkg)).not.toMatch(FORBIDDEN_DEPS);
    const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");
    expect(lockfile).toContain("@react-pdf/renderer@4.9.0");
    expect(lockfile.toLowerCase()).not.toContain("puppeteer@");
    expect(
      existsSync(join(root, "templates/fonts/LiberationSans-Regular.ttf")),
    ).toBe(true);
  });
});
