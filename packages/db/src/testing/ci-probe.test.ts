import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DB_HARNESS_DB_NAMES_FILE_ENV,
  DB_HARNESS_SETUP_COUNT_FILE_ENV,
  recordHarnessDatabaseName,
  recordHarnessSetupCount,
} from "./ci-probe.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("harness CI probes", () => {
  it("does nothing when probe env is unset", () => {
    expect(() => {
      recordHarnessSetupCount({});
    }).not.toThrow();
    expect(() => {
      recordHarnessDatabaseName("showzy_test_x", {});
    }).not.toThrow();
  });

  it("increments the setup counter file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "showzy-db-probe-"));
    dirs.push(dir);
    const file = path.join(dir, "setup-count");
    const env = { [DB_HARNESS_SETUP_COUNT_FILE_ENV]: file };
    recordHarnessSetupCount(env);
    recordHarnessSetupCount(env);
    expect(readFileSync(file, "utf8").trim()).toBe("2");
  });

  it("appends cloned database names", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "showzy-db-probe-"));
    dirs.push(dir);
    const file = path.join(dir, "db-names");
    const env = { [DB_HARNESS_DB_NAMES_FILE_ENV]: file };
    recordHarnessDatabaseName("showzy_test_aaa", env);
    recordHarnessDatabaseName("showzy_test_bbb", env);
    expect(readFileSync(file, "utf8").trim().split("\n")).toEqual([
      "showzy_test_aaa",
      "showzy_test_bbb",
    ]);
  });
});
