import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DB_HARNESS_DB_NAMES_FILE_ENV,
  DB_HARNESS_SETUP_COUNT_FILE_ENV,
  evaluateSharedDbRuntime,
  runAssertSharedDbRuntime,
} from "./assert-shared-db-runtime.mjs";

const script = fileURLToPath(
  new URL("./assert-shared-db-runtime.mjs", import.meta.url),
);

test("evaluateSharedDbRuntime accepts one setup and distinct clone names", () => {
  const result = evaluateSharedDbRuntime({
    setupCountText: "1\n",
    namesText: "showzy_test_aaa\nshowzy_test_bbb\n",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.setupCount, 1);
    assert.deepEqual(result.names, ["showzy_test_aaa", "showzy_test_bbb"]);
  }
});

test("evaluateSharedDbRuntime fails closed on missing, extra setup, and shared names", () => {
  assert.deepEqual(
    evaluateSharedDbRuntime({ setupCountText: undefined, namesText: "a" }),
    { ok: false, reason: "missing-setup-count" },
  );
  assert.equal(
    evaluateSharedDbRuntime({
      setupCountText: "2",
      namesText: "showzy_test_aaa\nshowzy_test_bbb",
    }).ok,
    false,
  );
  assert.equal(
    evaluateSharedDbRuntime({
      setupCountText: "1",
      namesText: "showzy_test_aaa\nshowzy_test_aaa",
    }).reason,
    "duplicate-clone-names",
  );
  assert.equal(
    evaluateSharedDbRuntime({
      setupCountText: "1",
      namesText: "showzy_test_aaa",
    }).reason,
    "too-few-clones:1",
  );
  assert.match(
    evaluateSharedDbRuntime({
      setupCountText: "1",
      namesText: "postgres\nshowzy_test_bbb",
    }).reason ?? "",
    /invalid-clone-name/,
  );
});

test("CLI reads probe files and exits 0 only for one setup plus unique clones", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "showzy-db-assert-"));
  const setupPath = path.join(dir, "setup");
  const namesPath = path.join(dir, "names");
  writeFileSync(setupPath, "1\n");
  writeFileSync(namesPath, "showzy_test_aaa\nshowzy_test_bbb\n");

  const isolatedEnv = {
    ...process.env,
    [DB_HARNESS_SETUP_COUNT_FILE_ENV]: setupPath,
    [DB_HARNESS_DB_NAMES_FILE_ENV]: namesPath,
  };
  assert.equal(runAssertSharedDbRuntime(isolatedEnv), 0);

  const ok = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: isolatedEnv,
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /1 global-setup/);

  writeFileSync(setupPath, "2\n");
  const failed = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: isolatedEnv,
  });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /setup-count-not-one:2/);
});
