import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DB_PACKAGE_UNIT_RELATIVE_FILES,
  classifyTestFile,
  listClassifiedTestFiles,
  repoRoot,
} from "./test-suite-files.mjs";

const forbidImport = fileURLToPath(
  new URL("./forbid-testcontainers.mjs", import.meta.url),
);

const TEST_PATH_RE = /\.test\.(tsx|ts|mjs)/;

/**
 * @param {string} source
 * @param {string} name
 */
function extractVitestNamedProject(source, name) {
  const marker = new RegExp(`name:\\s*"${name}"`);
  const start = source.search(marker);
  if (start < 0) {
    return "";
  }
  const rest = source.slice(start);
  const next = rest.slice(1).search(/name:\s*"(unit|db)"/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/**
 * @param {string} stdout
 * @returns {string[]}
 */
function parseVitestListPaths(stdout) {
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
 * @param {string} cwd
 * @param {string[]} args
 */
function vitestList(cwd, args) {
  return spawnSync("pnpm", ["exec", "vitest", "list", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, CI: "1" },
  });
}

test("packages/db postgres tests that are not *.db.test.ts stay classified as db", () => {
  assert.equal(classifyTestFile("packages/db/src/foundation.test.ts"), "db");
  assert.equal(
    classifyTestFile("packages/db/src/testing/isolation-a.test.ts"),
    "db",
  );
  assert.equal(
    classifyTestFile("packages/db/src/testing/ci-probe.test.ts"),
    "unit",
  );
  assert.equal(
    classifyTestFile("packages/core/src/errors/index.test.ts"),
    "unit",
  );
  assert.equal(
    classifyTestFile("packages/core/src/testing/kit.db.test.ts"),
    "db",
  );
});

test("on-disk unit and db files match the workspace Vitest DB suite collection", () => {
  const { unit, db } = listClassifiedTestFiles();
  assert.ok(unit.length > 0, "expected unit test files");
  assert.ok(db.length > 0, "expected db test files");
  assert.ok(
    db.some((file) => file.endsWith(".db.test.ts")),
    "expected *.db.test.ts files in the db set",
  );
  assert.ok(
    db.includes("packages/db/src/foundation.test.ts"),
    "packages/db postgres tests must not be orphaned as unit",
  );
  for (const file of DB_PACKAGE_UNIT_RELATIVE_FILES) {
    assert.ok(unit.includes(file), `missing db-package unit file ${file}`);
    assert.ok(!db.includes(file), `${file} must not be in the db suite`);
  }

  const dbConfig = fs.readFileSync(
    path.join(repoRoot, "packages/db/vitest.db.config.ts"),
    "utf8",
  );
  assert.match(dbConfig, /packages\/\*\*\/\*\.db\.test\.ts/);
  assert.match(dbConfig, /apps\/\*\*\/\*\.db\.test\.ts/);
  assert.match(dbConfig, /packages\/db\/src\/\*\*\/\*\.test\.ts/);
  for (const file of DB_PACKAGE_UNIT_RELATIVE_FILES) {
    assert.match(
      dbConfig,
      new RegExp(file.replaceAll(".", "\\.")),
      `vitest.db.config.ts must exclude ${file}`,
    );
  }
  assert.match(dbConfig, /globalSetup/);
  assert.doesNotMatch(dbConfig, /--shard/);

  const listed = vitestList(path.join(repoRoot, "packages/db"), [
    "--config",
    "vitest.db.config.ts",
  ]);
  const output = `${listed.stdout}\n${listed.stderr}`;
  assert.equal(listed.status, 0, `vitest list (db suite) failed:\n${output}`);
  const collected = parseVitestListPaths(output);
  assert.deepEqual(
    collected,
    db,
    "DB suite collection drifted from on-disk db files (orphan or extra)",
  );
});

test("Vitest unit projects do not register the Postgres global-setup", () => {
  const configPaths = [
    ...fs.globSync("**/vitest.config.ts", { cwd: repoRoot }),
    ...fs.globSync("**/vitest.config.mjs", { cwd: repoRoot }),
  ]
    .map((relative) => relative.replaceAll("\\", "/"))
    .filter((relative) => !relative.includes("node_modules"))
    .filter((relative) => relative !== "packages/db/vitest.db.config.ts");

  assert.ok(configPaths.length > 0);
  for (const relative of configPaths) {
    const source = fs.readFileSync(path.join(repoRoot, relative), "utf8");
    const unitBlock = extractVitestNamedProject(source, "unit");
    if (unitBlock) {
      assert.doesNotMatch(
        unitBlock,
        /globalSetup/,
        `${relative} unit project must not start PostgreSQL`,
      );
    } else {
      assert.doesNotMatch(
        source,
        /globalSetup/,
        `${relative} has no unit project and must not start PostgreSQL`,
      );
    }
    const dbBlock = extractVitestNamedProject(source, "db");
    if (relative === "packages/db/vitest.config.ts") {
      assert.match(dbBlock, /globalSetup/);
    }
  }
});

test("a unit-only Vitest run does not load PostgreSqlContainer", () => {
  const result = spawnSync(
    "pnpm",
    [
      "--filter",
      "@showzy/core",
      "exec",
      "vitest",
      "run",
      "--project",
      "unit",
      "src/errors/index.test.ts",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_OPTIONS: `--import ${forbidImport}`,
      },
    },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  assert.doesNotMatch(output, /must not import @testcontainers\/postgresql/);
});

test("on-disk unit files stay collected by package unit suites", () => {
  const { unit } = listClassifiedTestFiles();
  /** @type {Set<string>} */
  const collected = new Set();

  const packageJsonPaths = fs
    .globSync("**/package.json", { cwd: repoRoot })
    .map((relative) => relative.replaceAll("\\", "/"))
    .filter((relative) => !relative.includes("node_modules"))
    .filter((relative) => relative !== "package.json")
    .filter(
      (relative) => !relative.startsWith("packages/document-signing/wasm/"),
    );

  for (const relative of packageJsonPaths) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, relative), "utf8"),
    );
    const script = manifest.scripts?.["test:unit"];
    if (typeof script !== "string") {
      continue;
    }
    const cwd = path.join(repoRoot, path.dirname(relative));
    if (script.startsWith("node --test")) {
      const toolingFiles = [
        ...fs.globSync("eslint/*.test.mjs", { cwd }),
        ...fs.globSync("ci/*.test.mjs", { cwd }),
      ].map((file) =>
        path.join(path.dirname(relative), file).replaceAll("\\", "/"),
      );
      for (const file of toolingFiles) {
        collected.add(file);
      }
      continue;
    }
    const args = script.includes("--project unit") ? ["--project", "unit"] : [];
    const listed = vitestList(cwd, args);
    const output = `${listed.stdout}\n${listed.stderr}`;
    assert.equal(
      listed.status,
      0,
      `vitest list unit failed in ${relative}:\n${output}`,
    );
    for (const file of parseVitestListPaths(output)) {
      const normalized = file.replaceAll("\\", "/");
      const repoRelative =
        normalized.startsWith("apps/") || normalized.startsWith("packages/")
          ? normalized
          : path.posix.join(path.dirname(relative), normalized);
      collected.add(repoRelative);
    }
  }

  const missing = unit.filter((file) => !collected.has(file));
  assert.deepEqual(
    missing,
    [],
    `unit files dropped from collection:\n${missing.join("\n")}`,
  );
});
