#!/usr/bin/env node
/**
 * Compare on-disk DB test files to `vitest list` for the workspace DB
 * config (SHO-336). Run from the test-db job so unit CI does not pay
 * for collection. Does not start PostgreSQL (list only).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { listClassifiedTestFiles, repoRoot } from "./test-suite-files.mjs";

const TEST_PATH_RE = /\.test\.(tsx|ts|mjs)/;

/**
 * @param {string} stdout
 * @returns {string[]}
 */
export function parseVitestListPaths(stdout) {
  /** @type {Set<string>} */
  const files = new Set();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim().replaceAll("\\", "/");
    if (!TEST_PATH_RE.test(trimmed) && !trimmed.includes(".test.")) {
      continue;
    }
    const match = trimmed.match(/(\S+\.test\.(?:tsx|ts|mjs))/);
    if (!match) {
      continue;
    }
    let filePath = match[1];
    if (path.isAbsolute(filePath)) {
      filePath = path.relative(repoRoot, filePath);
    }
    files.add(filePath.replaceAll("\\", "/"));
  }
  return [...files].sort();
}

/**
 * @returns {{ ok: boolean, reason?: string, expected: string[], collected: string[] }}
 */
export function compareDbSuiteCollection() {
  const { db: expected } = listClassifiedTestFiles();
  const listed = spawnSync(
    "pnpm",
    ["exec", "vitest", "list", "--config", "vitest.db.config.ts"],
    {
      cwd: path.join(repoRoot, "packages/db"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, CI: "1" },
    },
  );
  const output = `${listed.stdout}\n${listed.stderr}`;
  if (listed.status !== 0) {
    return {
      ok: false,
      reason: `vitest list failed:\n${output}`,
      expected,
      collected: [],
    };
  }
  const collected = parseVitestListPaths(output);
  if (collected.join("\n") !== expected.join("\n")) {
    const missing = expected.filter((file) => !collected.includes(file));
    const extra = collected.filter((file) => !expected.includes(file));
    return {
      ok: false,
      reason: `collection drift missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
      expected,
      collected,
    };
  }
  return { ok: true, expected, collected };
}

/**
 * @returns {number}
 */
export function runAssertTestSuiteCollection() {
  const result = compareDbSuiteCollection();
  if (!result.ok) {
    console.error(result.reason);
    return 1;
  }
  console.log(
    `DB suite collection: ${String(result.collected.length)} files match on-disk classification`,
  );
  return 0;
}

const invoked =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invoked) {
  process.exitCode = runAssertTestSuiteCollection();
}
