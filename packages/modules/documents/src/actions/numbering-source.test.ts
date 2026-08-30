import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN =
  /\.getFullYear\s*\(|\.getUTCFullYear\s*\(|extract\s*\(\s*year|date-fns|getCompany\b|companies\.get\b/;

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

function executableSource(relative: string): string {
  return readSrc(relative)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

describe("documents numbering and issued date source", () => {
  it("does not use getFullYear, UTC year, SQL extract year, date-fns, or companies.get", () => {
    const sources = [
      "actions/create-from-order.ts",
      "actions/cancel.ts",
      "actions/get.ts",
      "actions/get-shared.ts",
      "actions/list.ts",
      "actions/request-sign.ts",
      "actions/share.ts",
      "actions/get-for-generation.ts",
      "services/create-from-order.ts",
      "services/document-number.ts",
      "services/kyiv-calendar-day.ts",
      "services/load-document.ts",
      "services/load-generation.ts",
      "services/mint-share-pdf.ts",
      "services/share-origin.ts",
      "services/share-pdf-url.ts",
      "services/snapshots.ts",
      "services/token-hash.ts",
    ];
    for (const relative of sources) {
      expect(executableSource(relative), relative).not.toMatch(FORBIDDEN);
    }
    expect(readSrc("actions/create-from-order.ts")).toContain("getSellerFacts");
    expect(readSrc("actions/create-from-order.ts")).toContain("getOrder");
    expect(readSrc("actions/create-from-order.ts")).toContain(
      "getCounterparty",
    );
    expect(readSrc("actions/create-from-order.ts")).toContain("getCustomer");
  });
});
