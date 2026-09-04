import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  decideFromChangedPaths,
  isAbsentSha,
  pathAffectsDependencyAudit,
  runDependencyAuditScope,
  runScopeCli,
} from "./dependency-audit-scope.mjs";

const script = fileURLToPath(
  new URL("./dependency-audit-scope.mjs", import.meta.url),
);

test("pathAffectsDependencyAudit matches lockfile, workspace, package.json, npmrc", () => {
  assert.equal(pathAffectsDependencyAudit("pnpm-lock.yaml"), true);
  assert.equal(pathAffectsDependencyAudit("pnpm-workspace.yaml"), true);
  assert.equal(pathAffectsDependencyAudit("package.json"), true);
  assert.equal(pathAffectsDependencyAudit("apps/web/package.json"), true);
  assert.equal(pathAffectsDependencyAudit(".npmrc"), true);
  assert.equal(pathAffectsDependencyAudit("apps/mobile/.npmrc"), true);
  assert.equal(
    pathAffectsDependencyAudit("apps/web/src/orders-page.ts"),
    false,
  );
  assert.equal(
    pathAffectsDependencyAudit("docs/operations/ci-flakes.md"),
    false,
  );
  assert.equal(pathAffectsDependencyAudit("packages/core/src/index.ts"), false);
});

test("decideFromChangedPaths runs audit only when a manifest path changed", () => {
  assert.deepEqual(
    decideFromChangedPaths(["apps/web/src/foo.ts", "README.md"]),
    { audit: false, reason: "manifest-unchanged", changed: [] },
  );
  assert.deepEqual(decideFromChangedPaths(["pnpm-lock.yaml"]), {
    audit: true,
    reason: "manifest-changed",
    changed: ["pnpm-lock.yaml"],
  });
  assert.deepEqual(
    decideFromChangedPaths([
      "apps/api/src/index.ts",
      "packages/db/package.json",
    ]),
    {
      audit: true,
      reason: "manifest-changed",
      changed: ["packages/db/package.json"],
    },
  );
});

test("isAbsentSha treats empty and GitHub's zero SHA as missing", () => {
  assert.equal(isAbsentSha(undefined), true);
  assert.equal(isAbsentSha(""), true);
  assert.equal(isAbsentSha("0000000000000000000000000000000000000000"), true);
  assert.equal(isAbsentSha("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
});

test("workflow_dispatch and unknown events fail closed to running audit", () => {
  const stdout = [];
  assert.equal(
    runDependencyAuditScope(
      { GITHUB_EVENT_NAME: "workflow_dispatch" },
      { stdoutWrite: (chunk) => stdout.push(chunk) },
    ).audit,
    true,
  );
  assert.match(stdout.join(""), /workflow_dispatch/);
  assert.equal(
    runDependencyAuditScope(
      { GITHUB_EVENT_NAME: "schedule" },
      { stdoutWrite: () => {} },
    ).reason,
    "unknown-event",
  );
});

test("unresolved PR base and missing push before SHA fail closed to audit", () => {
  const missing = runDependencyAuditScope(
    {
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_BASE_REF: "main",
      PR_BASE_SHA: "not-a-commit",
    },
    {
      spawnSync: () => ({ status: 1, stdout: "", stderr: "missing" }),
      stdoutWrite: () => {},
    },
  );
  assert.equal(missing.audit, true);
  assert.equal(missing.reason, "unresolved-base");

  const noBefore = runDependencyAuditScope(
    {
      GITHUB_EVENT_NAME: "push",
      PUSH_BEFORE_SHA: "0000000000000000000000000000000000000000",
    },
    { stdoutWrite: () => {} },
  );
  assert.equal(noBefore.audit, true);
  assert.equal(noBefore.reason, "unresolved-before");
});

test("push with an empty diff against before omits pnpm audit", () => {
  const calls = [];
  const decision = runDependencyAuditScope(
    {
      GITHUB_EVENT_NAME: "push",
      PUSH_BEFORE_SHA: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    {
      spawnSync: (command, args) => {
        calls.push(args);
        if (args[0] === "cat-file") {
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "diff") {
          return {
            status: 0,
            stdout: "apps/web/src/page.ts\nREADME.md\n",
            stderr: "",
          };
        }
        return { status: 1, stdout: "", stderr: "unexpected" };
      },
      stdoutWrite: () => {},
    },
  );
  assert.equal(decision.audit, false);
  assert.equal(decision.reason, "manifest-unchanged");
  assert.ok(
    calls.some(
      (args) =>
        args[0] === "diff" &&
        args.includes("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb...HEAD"),
    ),
  );
});

test("PR merge-base with a lockfile change runs audit", () => {
  const decision = runDependencyAuditScope(
    {
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_BASE_REF: "main",
      PR_BASE_SHA: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    {
      spawnSync: (command, args) => {
        if (args[0] === "cat-file") {
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "merge-base") {
          return {
            status: 0,
            stdout: "mergebase00000000000000000000000000000000\n",
            stderr: "",
          };
        }
        if (args[0] === "diff") {
          return { status: 0, stdout: "pnpm-lock.yaml\n", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "unexpected" };
      },
      stdoutWrite: () => {},
    },
  );
  assert.equal(decision.audit, true);
  assert.equal(decision.reason, "manifest-changed");
  assert.deepEqual(decision.changed, ["pnpm-lock.yaml"]);
});

test("writeScopeResult records run=true/false on GITHUB_OUTPUT", () => {
  const outputPath = path.join(
    os.tmpdir(),
    `showzy-audit-scope-${process.pid}.txt`,
  );
  fs.writeFileSync(outputPath, "");
  try {
    runDependencyAuditScope(
      { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_OUTPUT: outputPath },
      { stdoutWrite: () => {} },
    );
    assert.equal(fs.readFileSync(outputPath, "utf8"), "run=true\n");
  } finally {
    fs.unlinkSync(outputPath);
  }
});

test("CLI print-only exits 0 and does not require git for workflow_dispatch", () => {
  const result = spawnSync(process.execPath, [script, "--print-only"], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_OUTPUT: "",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(payload.run, true);
  assert.equal(payload.reason, "workflow_dispatch");
});

test("runScopeCli print-only JSON matches a skipped manifest diff", () => {
  const chunks = [];
  const code = runScopeCli(
    ["--print-only"],
    {
      GITHUB_EVENT_NAME: "push",
      PUSH_BEFORE_SHA: "cccccccccccccccccccccccccccccccccccccccc",
    },
    {
      spawnSync: (command, args) => {
        if (args[0] === "cat-file") {
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "diff") {
          return { status: 0, stdout: "apps/web/src/x.ts\n", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "" };
      },
      stdoutWrite: (chunk) => chunks.push(chunk),
    },
  );
  assert.equal(code, 0);
  const payload = JSON.parse(chunks.join("").trim());
  assert.equal(payload.run, false);
  assert.equal(payload.reason, "manifest-unchanged");
});
