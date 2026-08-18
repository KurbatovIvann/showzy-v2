import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const packageRoot = path.resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const probeScript = path.join(packageRoot, "scripts/bundle-probe.mjs");
const probeDir = path.join(packageRoot, "probe");

async function probe(entry?: string): Promise<string> {
  const args = entry === undefined ? [probeScript] : [probeScript, entry];
  try {
    await execFileAsync(process.execPath, args, {
      cwd: packageRoot,
      encoding: "utf8",
    });
    return "";
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "stderr" in error &&
      typeof error.stderr === "string"
    ) {
      return error.stderr;
    }
    throw error;
  }
}

describe("bundle probe", () => {
  it("passes for the real typed-client entry", async () => {
    await expect(probe()).resolves.toBe("");
  });

  it("fails on a seeded @showzy/core server-import leak", async () => {
    const stderr = await probe(path.join(probeDir, "leaks/server-core.ts"));
    expect(stderr).toContain("@showzy/core");
  });

  it("fails on a seeded Node builtin leak", async () => {
    const stderr = await probe(path.join(probeDir, "leaks/node-builtin.ts"));
    expect(stderr).toContain("Node builtin");
  });

  it("fails on a seeded @showzy/db leak", async () => {
    const stderr = await probe(path.join(probeDir, "leaks/db-import.ts"));
    expect(stderr).toContain("@showzy/db");
  });
});
