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

  it("native adapter does not INIT online without a registered HTTP handler", () => {
    const text = readFileSync(
      join(srcRoot, "platform/native-adapter.ts"),
      "utf8",
    );
    expect(text).toContain("nativeAdapterHttpPlan");
    expect(text).toContain("setHttpHandler");
    expect(text).not.toMatch(/offline:\s*false/);
  });

  it("native adapter loads Nitro via a static import (Metro-safe)", () => {
    const text = readFileSync(
      join(srcRoot, "platform/native-adapter.ts"),
      "utf8",
    );
    expect(text).toContain(
      'import { NitroModules } from "react-native-nitro-modules"',
    );
    expect(text).toContain(
      'NitroModules.createHybridObject<UapkiEngine>("UapkiEngine")',
    );
    expect(text).not.toContain("loadNitroModules");
    expect(text).not.toContain("NitroModulesApi");
    expect(text).not.toContain("globalThis");
    expect(text).not.toMatch(/\brequire\s*\(/);
  });

  it("node adapter honors corsProxyUrl and does not INIT online without a proxy", () => {
    const text = readFileSync(
      join(srcRoot, "platform/node-adapter.ts"),
      "utf8",
    );
    expect(text).toContain("nodeAdapterHttpPlan");
    expect(text).toContain("applyWasmCorsProxy");
    expect(text).not.toMatch(/offline:\s*false/);
    expect(text).not.toMatch(/void options/);
  });
});
