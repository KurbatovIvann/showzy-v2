import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

function executableSource(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

describe("customers → pricing source guard (SHO-281)", () => {
  it("nests getPriceList through the leaf entry, not the pricing barrel", () => {
    const source = executableSource("resolve-price-list.ts");
    expect(source).toContain("@showzy/pricing/get-price-list");
    expect(source).not.toContain('from "@showzy/pricing"');
    expect(source).toContain("ctx.call(getPriceList");
  });
});
