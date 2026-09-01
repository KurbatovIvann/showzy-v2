import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const turbo = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "turbo.json"), "utf8"),
);
const cacheAction = fs.readFileSync(
  path.join(repoRoot, ".github/actions/turbo-local-cache/action.yml"),
  "utf8",
);

const REQUIRED_GLOBAL_INPUTS = [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package.json",
  "prettier.config.mjs",
  "packages/tooling/package.json",
  "packages/tooling/tsconfig/base.json",
];

test("turbo.json hashes lockfile, manifests, and shared tooling configs", () => {
  const globals = turbo.globalDependencies;
  assert.ok(Array.isArray(globals));
  for (const entry of REQUIRED_GLOBAL_INPUTS) {
    assert.ok(globals.includes(entry), `missing globalDependency ${entry}`);
  }
  assert.ok(globals.includes("packages/tooling/prettier/**"));
  assert.ok(globals.includes("packages/tooling/eslint/**"));
  assert.equal(turbo.tasks["e2e-smoke"].cache, false);
});

test("typecheck, lint, test, and builds declare inputs so config changes miss cache", () => {
  for (const name of ["typecheck", "lint", "test", "build", "export:web"]) {
    const inputs = turbo.tasks[name].inputs;
    assert.ok(
      Array.isArray(inputs) && inputs.includes("$TURBO_DEFAULT$"),
      `${name} must hash package sources`,
    );
    assert.ok(
      (turbo.tasks[name].dependsOn ?? []).includes("topo"),
      `${name} must depend on topo so workspace dependents invalidate`,
    );
  }
  assert.ok(turbo.tasks.typecheck.inputs.includes("tsconfig.json"));
  assert.ok(turbo.tasks.lint.inputs.includes("eslint.config.*"));
  assert.ok(turbo.tasks.test.inputs.includes("vitest.config.*"));
  assert.deepEqual(turbo.tasks.build.outputs, ["dist/**"]);
  assert.deepEqual(turbo.tasks["export:web"].outputs, ["dist/**"]);
});

test("topo walks the package graph without requiring a per-package script", () => {
  assert.deepEqual(turbo.tasks.topo.dependsOn, ["^topo"]);
});

test(".turbo GitHub cache is keyed on lockfile/turbo/tooling and skips forks", () => {
  assert.match(cacheAction, /path:\s+\.turbo/);
  assert.match(cacheAction, /hashFiles\('pnpm-lock\.yaml'/);
  assert.match(cacheAction, /turbo\.json/);
  assert.match(cacheAction, /packages\/tooling\/tsconfig\/base\.json/);
  assert.match(cacheAction, /packages\/tooling\/eslint\/base\.mjs/);
  assert.match(
    cacheAction,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.doesNotMatch(cacheAction, /path:\s*node_modules/);
  assert.doesNotMatch(cacheAction, /TURBO_TOKEN:/);
});
