/**
 * SHO-330: one contract data path. Views/routes never `fetch` domain data
 * or construct a second client; invalidations stay keyed; no second cache.
 */
// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "..");

function listFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function productionSources(): string[] {
  return listFiles(webSrc).filter((file) => {
    if (!/\.(ts|tsx)$/.test(file)) {
      return false;
    }
    if (/\.test\.(ts|tsx)$/.test(file)) {
      return false;
    }
    if (file.includes("/test/")) {
      return false;
    }
    if (file.endsWith("/routeTree.gen.ts")) {
      return false;
    }
    return true;
  });
}

describe("web contract data path (SHO-330)", () => {
  const files = productionSources();

  it("keeps fetch and client construction on the shared oRPC adapter", () => {
    const fetchFiles = files.filter((file) =>
      /\bfetch\s*\(/.test(readFileSync(file, "utf8")),
    );
    expect(fetchFiles).toEqual([join(webSrc, "api/client.ts")]);

    const constructors = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return (
        /\bcreateShowzyClient\s*\(/.test(text) ||
        /\bcreateContractClient\s*\(/.test(text)
      );
    });
    expect(constructors.sort()).toEqual(
      [
        join(webSrc, "api/api-provider.tsx"),
        join(webSrc, "api/client.ts"),
        join(webSrc, "app/runtime.ts"),
      ].sort(),
    );
  });

  it("does not import the contract client from routes, layouts, or views", () => {
    const forbidden = files.filter((file) => {
      const rel = file.slice(webSrc.length + 1);
      if (rel.startsWith("api/") || rel.startsWith("app/")) {
        return false;
      }
      if (rel.startsWith("features/") && /\/api\//.test(rel)) {
        return false;
      }
      const text = readFileSync(file, "utf8");
      return /from ["'][^"']*\/api\/client["']/.test(text);
    });
    expect(forbidden).toEqual([]);
  });

  it("never issues an unqualified cache invalidate or a Zustand store", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/invalidateQueries\(\s*\)/);
      expect(text).not.toMatch(/from ["']zustand["']/);
    }
  });
});
