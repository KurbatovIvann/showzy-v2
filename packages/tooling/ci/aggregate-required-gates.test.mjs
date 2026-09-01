import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateRequiredGates,
  parseGateArgs,
  runAggregate,
} from "./aggregate-required-gates.mjs";
import { REQUIRED_QUALITY_GATES } from "./required-quality-gates.mjs";

const script = fileURLToPath(
  new URL("./aggregate-required-gates.mjs", import.meta.url),
);

function allSuccessArgs() {
  return REQUIRED_QUALITY_GATES.map((name) => `${name}=success`);
}

test("evaluateRequiredGates succeeds only when every required gate is success", () => {
  const results = Object.fromEntries(
    REQUIRED_QUALITY_GATES.map((name) => [name, "success"]),
  );
  assert.deepEqual(evaluateRequiredGates(results), { ok: true, failures: [] });
});

test("evaluateRequiredGates fails closed on failure, cancelled, skipped, empty, and missing", () => {
  const base = Object.fromEntries(
    REQUIRED_QUALITY_GATES.map((name) => [name, "success"]),
  );

  assert.deepEqual(evaluateRequiredGates({ ...base, lint: "failure" }), {
    ok: false,
    failures: [{ name: "lint", result: "failure" }],
  });
  assert.deepEqual(
    evaluateRequiredGates({ ...base, "test-unit": "cancelled" }),
    {
      ok: false,
      failures: [{ name: "test-unit", result: "cancelled" }],
    },
  );
  assert.deepEqual(evaluateRequiredGates({ ...base, format: "skipped" }), {
    ok: false,
    failures: [{ name: "format", result: "skipped" }],
  });
  assert.deepEqual(evaluateRequiredGates({ ...base, "e2e-smoke": "" }), {
    ok: false,
    failures: [{ name: "e2e-smoke", result: "missing" }],
  });

  const withoutTypecheck = { ...base };
  delete withoutTypecheck.typecheck;
  assert.deepEqual(evaluateRequiredGates(withoutTypecheck), {
    ok: false,
    failures: [{ name: "typecheck", result: "missing" }],
  });
});

test("parseGateArgs reads name=result pairs including hyphenated job ids", () => {
  assert.deepEqual(parseGateArgs(["format=success", "build-smoke=failure"]), {
    format: "success",
    "build-smoke": "failure",
  });
  assert.throws(() => parseGateArgs(["nope"]), /Expected name=result/);
});

test("runAggregate and the CLI exit 0 only for a full success set", () => {
  const isolatedEnv = { ...process.env, GITHUB_STEP_SUMMARY: "" };
  assert.equal(runAggregate(allSuccessArgs(), isolatedEnv), 0);
  assert.equal(runAggregate(["format=success"], isolatedEnv), 1);

  const ok = spawnSync(process.execPath, [script, ...allSuccessArgs()], {
    encoding: "utf8",
    env: isolatedEnv,
  });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /All required gates succeeded/);

  const failed = spawnSync(
    process.execPath,
    [
      script,
      ...allSuccessArgs().map((arg) =>
        arg.replace("lint=success", "lint=failure"),
      ),
    ],
    { encoding: "utf8", env: isolatedEnv },
  );
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Required gate 'lint' result is 'failure'/);

  const cancelled = spawnSync(
    process.execPath,
    [
      script,
      ...allSuccessArgs().map((arg) =>
        arg.replace("secret-scan=success", "secret-scan=cancelled"),
      ),
    ],
    { encoding: "utf8", env: isolatedEnv },
  );
  assert.equal(cancelled.status, 1);
  assert.match(
    cancelled.stderr,
    /Required gate 'secret-scan' result is 'cancelled'/,
  );
});
