#!/usr/bin/env node
/**
 * Compare on-disk DB test files to `vitest list` for the workspace DB
 * config (SHO-336). Run from the test-db job so unit CI does not pay
 * for collection.
 *
 * `vitest list` without `--filesOnly` / `--staticParse` calls
 * `collectTests()` → `initializeGlobalSetup()`, which starts PostgreSQL
 * and increments the shared-runtime probe. Collection must glob (or
 * statically parse) only.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { listClassifiedTestFiles, repoRoot } from "./test-suite-files.mjs";

const TEST_PATH_RE = /\.test\.(tsx|ts|mjs)/;

export const DB_HARNESS_SETUP_COUNT_FILE_ENV =
  "SHOWZY_DB_HARNESS_SETUP_COUNT_FILE";
export const DB_HARNESS_DB_NAMES_FILE_ENV = "SHOWZY_DB_HARNESS_DB_NAMES_FILE";

export const DB_SUITE_LIST_CWD = path.join(repoRoot, "packages/db");

/**
 * `pnpm exec vitest list` arguments. `--filesOnly` skips collect/globalSetup;
 * `--staticParse` is the fallback if `--filesOnly` is dropped (AST collect,
 * still no globalSetup). Do not add `--shard`.
 */
export const DB_SUITE_LIST_ARGS = Object.freeze([
  "exec",
  "vitest",
  "list",
  "--config",
  "vitest.db.config.ts",
  "--filesOnly",
  "--staticParse",
  "--no-color",
]);

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
 * `vitest list --filesOnly` prints paths relative to `packages/db`.
 * @param {string} filePath
 * @returns {string}
 */
export function toRepoRelativeListedPath(filePath) {
  const withForwardSlashes = filePath.replaceAll("\\", "/");
  if (path.isAbsolute(filePath)) {
    return path.relative(repoRoot, filePath).replaceAll("\\", "/");
  }
  if (
    withForwardSlashes.startsWith("packages/") ||
    withForwardSlashes.startsWith("apps/")
  ) {
    return withForwardSlashes;
  }
  return path
    .relative(repoRoot, path.resolve(DB_SUITE_LIST_CWD, filePath))
    .replaceAll("\\", "/");
}

/**
 * Probe env on the parent must not reach `vitest list`. Unsetting is
 * defense in depth — flags must still skip globalSetup (a second
 * container would otherwise be silent).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function dbSuiteCollectionChildEnv(env = process.env) {
  /** @type {NodeJS.ProcessEnv} */
  const child = { CI: "1" };
  for (const [key, value] of Object.entries(env)) {
    if (
      key === DB_HARNESS_SETUP_COUNT_FILE_ENV ||
      key === DB_HARNESS_DB_NAMES_FILE_ENV
    ) {
      continue;
    }
    child[key] = value;
  }
  return child;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: boolean, reason?: string, expected: string[], collected: string[] }}
 */
export function compareDbSuiteCollection(env = process.env) {
  const { db: expected } = listClassifiedTestFiles();
  const listed = spawnSync("pnpm", [...DB_SUITE_LIST_ARGS], {
    cwd: DB_SUITE_LIST_CWD,
    encoding: "utf8",
    timeout: 120_000,
    env: dbSuiteCollectionChildEnv(env),
  });
  const output = `${listed.stdout}\n${listed.stderr}`;
  if (listed.status !== 0) {
    return {
      ok: false,
      reason: `vitest list failed:\n${output}`,
      expected,
      collected: [],
    };
  }
  const collected = [
    ...new Set(parseVitestListPaths(output).map(toRepoRelativeListedPath)),
  ].sort();
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
