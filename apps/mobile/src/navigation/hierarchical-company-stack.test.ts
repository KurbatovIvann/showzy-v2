import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
        new URL(`../app/(app)/${name}/_layout.tsx`, import.meta.url),
        "utf8",
      ).trim();
      expect(source).toBe(
        'export { HierarchicalCompanyStack as default } from "../../../navigation/hierarchical-company-stack";',
      );
    }
  });
});
