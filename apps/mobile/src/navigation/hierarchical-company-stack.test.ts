import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAYOUTS = [
  "customers",
  "documents",
  "more",
  "orders",
  "price-lists",
  "products",
] as const;

describe("HierarchicalCompanyStack layouts", () => {
  it("keeps each company stack layout a one-line re-export", () => {
    for (const name of LAYOUTS) {
      const source = readFileSync(
        join(SRC, "app", "(app)", name, "_layout.tsx"),
        "utf8",
      ).trim();
      expect(source).toBe(
        'export { HierarchicalCompanyStack as default } from "../../../navigation/hierarchical-company-stack";',
      );
    }
  });
});
