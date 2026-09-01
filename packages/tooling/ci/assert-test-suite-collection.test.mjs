import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DB_HARNESS_DB_NAMES_FILE_ENV,
  DB_HARNESS_SETUP_COUNT_FILE_ENV,
  DB_SUITE_LIST_ARGS,
  compareDbSuiteCollection,
  dbSuiteCollectionChildEnv,
  parseVitestListPaths,
  toRepoRelativeListedPath,
} from "./assert-test-suite-collection.mjs";

const forbidImport = fileURLToPath(
  new URL("./forbid-testcontainers.mjs", import.meta.url),
);

test("collection list args skip execution and globalSetup", () => {
  assert.ok(DB_SUITE_LIST_ARGS.includes("--filesOnly"));
  assert.ok(DB_SUITE_LIST_ARGS.includes("--staticParse"));
  assert.ok(DB_SUITE_LIST_ARGS.includes("vitest.db.config.ts"));
  assert.ok(!DB_SUITE_LIST_ARGS.includes("--shard"));
});

test("collection child env strips harness probe paths", () => {
  const child = dbSuiteCollectionChildEnv({
    PATH: "/usr/bin",
    [DB_HARNESS_SETUP_COUNT_FILE_ENV]: "/tmp/count",
    [DB_HARNESS_DB_NAMES_FILE_ENV]: "/tmp/names",
  });
  assert.equal(child.CI, "1");
  assert.equal(child[DB_HARNESS_SETUP_COUNT_FILE_ENV], undefined);
  assert.equal(child[DB_HARNESS_DB_NAMES_FILE_ENV], undefined);
  assert.equal(child.PATH, "/usr/bin");
});

test("filesOnly list paths resolve to repo-relative classified files", () => {
  const listed = parseVitestListPaths(
    "[db] src/foundation.test.ts\n[db] ../../apps/worker/src/jobs.db.test.ts\n",
  );
  assert.deepEqual(listed.map(toRepoRelativeListedPath).sort(), [
    "apps/worker/src/jobs.db.test.ts",
    "packages/db/src/foundation.test.ts",
  ]);
});

test("compareDbSuiteCollection under probe env does not start PostgreSQL", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "showzy-db-collection-"));
  const setupPath = path.join(dir, "setup-count");
  const namesPath = path.join(dir, "db-names");
  try {
    const result = compareDbSuiteCollection({
      ...process.env,
      [DB_HARNESS_SETUP_COUNT_FILE_ENV]: setupPath,
      [DB_HARNESS_DB_NAMES_FILE_ENV]: namesPath,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import ${forbidImport}`]
        .filter(Boolean)
        .join(" "),
    });
    assert.equal(result.ok, true, result.reason);
    assert.ok(result.collected.length > 0, "expected collected DB files");
    assert.ok(
      result.collected.includes("packages/db/src/foundation.test.ts"),
      "collection must resolve packages/db-relative list paths",
    );

    assert.equal(
      existsSync(setupPath),
      false,
      "collection must not increment the setup-count probe",
    );
    assert.equal(
      existsSync(namesPath),
      false,
      "collection must not record cloned database names",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
