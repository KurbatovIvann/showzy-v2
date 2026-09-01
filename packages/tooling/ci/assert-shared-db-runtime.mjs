#!/usr/bin/env node
/**
 * Fail-closed probe for the shared DB suite (SHO-336).
 *
 * The test-db job sets SHOWZY_DB_HARNESS_SETUP_COUNT_FILE and
 * SHOWZY_DB_HARNESS_DB_NAMES_FILE so global-setup / createTestDatabase
 * record one template boot and unique clone names. This script does not
 * start PostgreSQL.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DB_HARNESS_SETUP_COUNT_FILE_ENV =
  "SHOWZY_DB_HARNESS_SETUP_COUNT_FILE";
export const DB_HARNESS_DB_NAMES_FILE_ENV = "SHOWZY_DB_HARNESS_DB_NAMES_FILE";

const CLONE_NAME_RE = /^showzy_test_[0-9a-f]+$/;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseDatabaseNames(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {{
 *   setupCountText: string | undefined,
 *   namesText: string | undefined,
 * }} input
 * @returns {{ ok: true, setupCount: number, names: string[] } | { ok: false, reason: string }}
 */
export function evaluateSharedDbRuntime(input) {
  if (
    input.setupCountText === undefined ||
    input.setupCountText.trim() === ""
  ) {
    return { ok: false, reason: "missing-setup-count" };
  }
  const setupCount = Number.parseInt(input.setupCountText.trim(), 10);
  if (!Number.isFinite(setupCount)) {
    return { ok: false, reason: "invalid-setup-count" };
  }
  if (setupCount !== 1) {
    return {
      ok: false,
      reason: `setup-count-not-one:${String(setupCount)}`,
    };
  }

  if (input.namesText === undefined || input.namesText.trim() === "") {
    return { ok: false, reason: "missing-database-names" };
  }
  const names = parseDatabaseNames(input.namesText);
  if (names.length < 2) {
    return { ok: false, reason: `too-few-clones:${String(names.length)}` };
  }
  const unique = new Set(names);
  if (unique.size !== names.length) {
    return { ok: false, reason: "duplicate-clone-names" };
  }
  for (const name of names) {
    if (!CLONE_NAME_RE.test(name)) {
      return { ok: false, reason: `invalid-clone-name:${name}` };
    }
  }
  return { ok: true, setupCount, names };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function runAssertSharedDbRuntime(env = process.env) {
  const setupPath = env[DB_HARNESS_SETUP_COUNT_FILE_ENV];
  const namesPath = env[DB_HARNESS_DB_NAMES_FILE_ENV];
  if (!setupPath || !namesPath) {
    console.error(
      "SHOWZY_DB_HARNESS_SETUP_COUNT_FILE and SHOWZY_DB_HARNESS_DB_NAMES_FILE must be set",
    );
    return 2;
  }

  let setupCountText;
  let namesText;
  try {
    setupCountText = readFileSync(setupPath, "utf8");
  } catch {
    console.error(`Unable to read setup count file ${setupPath}`);
    return 1;
  }
  try {
    namesText = readFileSync(namesPath, "utf8");
  } catch {
    console.error(`Unable to read database names file ${namesPath}`);
    return 1;
  }

  const result = evaluateSharedDbRuntime({ setupCountText, namesText });
  if (!result.ok) {
    console.error(`Shared DB runtime probe failed: ${result.reason}`);
    return 1;
  }
  console.log(
    `Shared DB runtime: 1 global-setup, ${String(result.names.length)} unique cloned databases`,
  );
  return 0;
}

const invoked =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invoked) {
  process.exitCode = runAssertSharedDbRuntime();
}
