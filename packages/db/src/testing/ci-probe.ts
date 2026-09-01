import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

/**
 * Opt-in CI probe channels (SHO-336). Unset during ordinary local runs.
 * Not log lines — files the test-db job asserts after the suite.
 */
export const DB_HARNESS_SETUP_COUNT_FILE_ENV =
  "SHOWZY_DB_HARNESS_SETUP_COUNT_FILE";
export const DB_HARNESS_DB_NAMES_FILE_ENV = "SHOWZY_DB_HARNESS_DB_NAMES_FILE";

export function recordHarnessSetupCount(
  env: Record<string, string | undefined> = process.env,
): void {
  const file = env[DB_HARNESS_SETUP_COUNT_FILE_ENV];
  if (file === undefined || file === "") {
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const raw = existsSync(file) ? readFileSync(file, "utf8").trim() : "0";
  const current = Number.parseInt(raw, 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  writeFileSync(file, `${String(next)}\n`);
}

export function recordHarnessDatabaseName(
  name: string,
  env: Record<string, string | undefined> = process.env,
): void {
  const file = env[DB_HARNESS_DB_NAMES_FILE_ENV];
  if (file === undefined || file === "") {
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, `${name}\n`);
}
