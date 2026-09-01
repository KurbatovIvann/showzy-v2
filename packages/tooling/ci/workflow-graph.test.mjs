import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { REQUIRED_QUALITY_GATES } from "./required-quality-gates.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const workflowPath = path.join(repoRoot, ".github/workflows/ci.yml");
const setupActionPath = path.join(
  repoRoot,
  ".github/actions/setup-ci-workspace/action.yml",
);
const aggregatorScript = "packages/tooling/ci/aggregate-required-gates.mjs";
const timingScript = "packages/tooling/ci/publish-job-timing.sh";

const PARALLEL_CHECK_JOBS = [
  "format",
  "typecheck",
  "lint",
  "test",
  "build-smoke",
];

const INDEPENDENT_GATES = [
  "secret-scan",
  "dependency-audit",
  "contract-check",
  "migration-drift",
  "bundle-probe",
  "e2e-smoke",
];

/**
 * @param {string} source
 * @param {string} name
 */
function extractJob(source, name) {
  const start = source.search(new RegExp(`^ {2}${name}:\\s*$`, "m"));
  if (start < 0) {
    throw new Error(`missing job ${name}`);
  }
  const rest = source.slice(start);
  const next = rest.slice(1).search(/^ {2}[a-z][a-z0-9-]*:\s*$/m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/**
 * @param {string} block
 * @returns {string[]}
 */
function jobNeeds(block) {
  const list = block.match(/^ {4}needs:\s*\n((?: {6}- [^\n]+\n)+)/m);
  if (list) {
    return [...list[1].matchAll(/^ {6}- (\S+)/gm)].map((match) => match[1]);
  }
  const inline = block.match(/^ {4}needs:\s*\[([^\]]*)\]/m);
  if (inline) {
    return inline[1]
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [];
}

/**
 * @param {string} block
 */
function jobIf(block) {
  const match = block.match(/^ {4}if:\s*(.+)$/m);
  return match ? match[1].trim() : undefined;
}

const turboCacheActionPath = path.join(
  repoRoot,
  ".github/actions/turbo-local-cache/action.yml",
);

const TURBO_TASK_JOBS = ["typecheck", "lint", "test", "build-smoke"];

const workflow = fs.readFileSync(workflowPath, "utf8");
const setupAction = fs.readFileSync(setupActionPath, "utf8");
const turboCacheAction = fs.readFileSync(turboCacheActionPath, "utf8");

test("CI workflow keeps concurrency cancellation and has no retries", () => {
  assert.match(workflow, /group:\s+ci-\$\{\{ github\.ref \}\}/);
  assert.match(
    workflow,
    /cancel-in-progress:\s+\$\{\{ github\.ref != 'refs\/heads\/main' \}\}/,
  );
  assert.doesNotMatch(workflow, /retry|rerun-on-failure|max-attempts/i);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});

test("format, typecheck, lint, test, and build-smoke are independent jobs", () => {
  for (const name of PARALLEL_CHECK_JOBS) {
    const block = extractJob(workflow, name);
    assert.deepEqual(
      jobNeeds(block),
      [],
      `${name} must not wait on other jobs`,
    );
    assert.match(block, /uses:\s+\.\/\.github\/actions\/setup-ci-workspace/);
    assert.match(block, /Record job start/);
    assert.match(block, /Publish job timing/);
    assert.match(block, /if: always\(\)/);
  }

  assert.match(extractJob(workflow, "format"), /pnpm format:check/);
  assert.match(extractJob(workflow, "typecheck"), /run-turbo\.mjs typecheck/);
  assert.match(extractJob(workflow, "lint"), /run-turbo\.mjs lint/);
  assert.match(extractJob(workflow, "test"), /run-turbo\.mjs test/);

  const buildSmoke = extractJob(workflow, "build-smoke");
  assert.match(
    buildSmoke,
    /run-turbo\.mjs export:web --filter=@showzy\/mobile/,
  );
  assert.match(buildSmoke, /run-turbo\.mjs build --filter=@showzy\/web/);

  const serialChecks = extractJob(workflow, "checks");
  assert.doesNotMatch(serialChecks, /pnpm format:check/);
  assert.doesNotMatch(serialChecks, /pnpm typecheck/);
  assert.doesNotMatch(serialChecks, /pnpm lint/);
  assert.doesNotMatch(serialChecks, /pnpm test/);
});

test("secret-scan and the other named gates remain independent workers", () => {
  for (const name of INDEPENDENT_GATES) {
    const block = extractJob(workflow, name);
    assert.deepEqual(
      jobNeeds(block),
      [],
      `${name} must stay an independent gate`,
    );
  }

  assert.match(
    extractJob(workflow, "secret-scan"),
    /gitleaks\/gitleaks-action@/,
  );
  assert.match(
    extractJob(workflow, "dependency-audit"),
    /pnpm audit --audit-level high/,
  );
  assert.match(extractJob(workflow, "contract-check"), /contract:check/);
  assert.match(extractJob(workflow, "migration-drift"), /db:check/);
  assert.match(extractJob(workflow, "bundle-probe"), /bundle:probe/);
  const e2eSmoke = extractJob(workflow, "e2e-smoke");
  assert.match(e2eSmoke, /playwright install --with-deps chromium/);
  assert.match(e2eSmoke, /e2e-smoke --filter=@showzy\/web/);
  assert.doesNotMatch(e2eSmoke, /Placeholder/);
});

test("checks is a fail-closed aggregator over every required quality job", () => {
  const checks = extractJob(workflow, "checks");
  assert.equal(jobIf(checks), "always()");
  assert.deepEqual(jobNeeds(checks), [...REQUIRED_QUALITY_GATES]);
  assert.match(checks, new RegExp(aggregatorScript.replaceAll(".", "\\.")));
  for (const name of REQUIRED_QUALITY_GATES) {
    assert.match(
      checks,
      new RegExp(`${name}=\\$\\{\\{ needs\\.${name}\\.result \\}\\}`),
    );
  }
  const header = checks.split(/^ {4}steps:/m)[0] ?? "";
  assert.doesNotMatch(
    header,
    /^ {4}name:/m,
    "job-level name would change the branch-protection check from `checks`",
  );
});

test("setup action caches the pnpm store and not node_modules", () => {
  assert.match(setupAction, /cache:\s+pnpm/);
  assert.doesNotMatch(setupAction, /cache:\s*['"]?node_modules/);
  assert.doesNotMatch(setupAction, /actions\/cache@/);
});

test("Turbo jobs persist keyed .turbo cache and use affected-or-full helper", () => {
  for (const name of TURBO_TASK_JOBS) {
    const block = extractJob(workflow, name);
    assert.match(block, /fetch-depth:\s+0/);
    assert.match(block, /Fetch PR base for Turbo affected/);
    assert.match(block, /uses:\s+\.\/\.github\/actions\/turbo-local-cache/);
    assert.match(block, /run-turbo\.mjs/);
    assert.match(block, /TURBO_PR_BASE_SHA/);
  }

  const format = extractJob(workflow, "format");
  assert.doesNotMatch(format, /run-turbo\.mjs/);
  assert.doesNotMatch(format, /turbo-local-cache/);

  const e2eSmoke = extractJob(workflow, "e2e-smoke");
  assert.doesNotMatch(e2eSmoke, /run-turbo\.mjs/);
  assert.doesNotMatch(e2eSmoke, /turbo-local-cache/);
  assert.match(e2eSmoke, /turbo run e2e-smoke --filter=@showzy\/web/);

  assert.doesNotMatch(workflow, /TURBO_TOKEN:/);
  assert.doesNotMatch(workflow, /secrets\.TURBO_TOKEN/);
  assert.match(turboCacheAction, /path:\s+\.turbo/);
  assert.doesNotMatch(turboCacheAction, /path:\s*node_modules/);
  assert.doesNotMatch(setupAction, /path:\s+\.turbo/);
});

test("publish-job-timing writes a duration summary without failing", () => {
  const scriptPath = path.join(repoRoot, timingScript);
  const summaryPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "publish-job-timing.summary.tmp.md",
  );
  fs.writeFileSync(summaryPath, "");
  try {
    const result = spawnSync("bash", [scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        JOB_START_EPOCH: String(Math.floor(Date.now() / 1000) - 4),
        GITHUB_JOB: "lint",
        JOB_RESULT: "success",
        GITHUB_STEP_SUMMARY: summaryPath,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const summary = fs.readFileSync(summaryPath, "utf8");
    assert.match(summary, /## lint timing/);
    assert.match(summary, /Duration seconds/);
    assert.match(result.stdout, /Job lint finished in \d+s with success/);
  } finally {
    fs.unlinkSync(summaryPath);
  }
});
