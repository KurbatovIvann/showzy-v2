import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PKI_PROXY_PATH } from "./pki/proxy.js";

const srcRoot = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN = [/supabase/i, /\/api\/v1\/pki\/proxy/] as const;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (!name.endsWith(".ts")) continue;
    if (name.endsWith(".test.ts")) continue;
    out.push(full);
  }
  return out;
}

describe("adapter re-audit (SHO-252)", () => {
  it("exports the v2 PKI proxy path", () => {
    expect(PKI_PROXY_PATH).toBe("/pki/proxy");
  });

  it("does not retain Supabase or v1 CORS proxy assumptions in production source", () => {
    const files = walkTsFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          hits.push(`${file}: ${pattern.source}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
