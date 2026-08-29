import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN =
  /getFullYear|getUTCFullYear|extract\s*\(\s*year|date-fns|getCompany\b|companies\.get\b/;

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("documents numbering and issued date source", () => {
  it("does not use getFullYear, UTC year, SQL extract year, date-fns, or companies.get", () => {
    const sources = [
      "actions/create-from-order.ts",
      "services/create-from-order.ts",
      "services/document-number.ts",
      "services/kyiv-calendar-day.ts",
      "services/snapshots.ts",
    ];
    for (const relative of sources) {
      const source = readSrc(relative);
      expect(source, relative).not.toMatch(FORBIDDEN);
    }
    expect(readSrc("actions/create-from-order.ts")).toContain("getSellerFacts");
    expect(readSrc("actions/create-from-order.ts")).toContain("getOrder");
    expect(readSrc("actions/create-from-order.ts")).toContain(
      "getCounterparty",
    );
    expect(readSrc("actions/create-from-order.ts")).toContain("getCustomer");
  });
});
