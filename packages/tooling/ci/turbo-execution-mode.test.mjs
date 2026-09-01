import assert from "node:assert/strict";
import { test } from "node:test";

import {
  TURBO_LOCAL_CACHE,
  buildTurboRunArgs,
  buildTurboRunEnv,
  resolveComparisonBase,
  resolveTurboExecutionMode,
  shouldPersistTurboCache,
} from "./turbo-execution-mode.mjs";

test("push to main always runs the full workspace suite", () => {
  assert.deepEqual(
    resolveTurboExecutionMode({
      eventName: "push",
      ref: "refs/heads/main",
      baseRef: undefined,
      baseSha: undefined,
      mergeBase: "abc123",
    }),
    { mode: "full", reason: "push-to-main" },
  );
});

test("pull_request with a resolved merge-base uses Turbo affected + graph", () => {
  const decision = resolveTurboExecutionMode({
    eventName: "pull_request",
    ref: "refs/pull/12/merge",
    baseRef: "main",
    baseSha: "base-sha",
    mergeBase: "merge-base-sha",
  });
  assert.deepEqual(decision, {
    mode: "affected",
    reason: "pull-request",
    scmBase: "merge-base-sha",
    scmHead: "HEAD",
  });
  assert.deepEqual(buildTurboRunArgs("test", decision), [
    "run",
    "test",
    `--cache=${TURBO_LOCAL_CACHE}`,
    "--ui=stream",
    "--affected",
  ]);
  const env = buildTurboRunEnv(decision, { PATH: "/bin" });
  assert.equal(env.TURBO_SCM_BASE, "merge-base-sha");
  assert.equal(env.TURBO_SCM_HEAD, "HEAD");
});

test("unresolved or shallow PR base falls back to a full run", () => {
  const decision = resolveTurboExecutionMode({
    eventName: "pull_request",
    ref: "refs/pull/12/merge",
    baseRef: "main",
    baseSha: "missing",
    mergeBase: null,
  });
  assert.deepEqual(decision, { mode: "full", reason: "unresolved-base" });
  assert.deepEqual(
    buildTurboRunArgs("lint", decision, ["--filter=@showzy/web"]),
    [
      "run",
      "lint",
      `--cache=${TURBO_LOCAL_CACHE}`,
      "--ui=stream",
      "--filter=@showzy/web",
    ],
  );
  const env = buildTurboRunEnv(decision, { PATH: "/bin" });
  assert.equal(env.TURBO_SCM_BASE, undefined);
});

test("workflow_dispatch and throwaway pushes are full, not affected-only", () => {
  assert.deepEqual(
    resolveTurboExecutionMode({
      eventName: "push",
      ref: "refs/heads/throwaway/meta",
      baseRef: undefined,
      baseSha: undefined,
      mergeBase: null,
    }),
    { mode: "full", reason: "non-pr-event" },
  );
  assert.deepEqual(
    resolveTurboExecutionMode({
      eventName: "workflow_dispatch",
      ref: "refs/heads/main",
      baseRef: undefined,
      baseSha: undefined,
      mergeBase: null,
    }),
    { mode: "full", reason: "non-pr-event" },
  );
});

test("resolveComparisonBase uses merge-base when the object exists", () => {
  const seen = [];
  const resolved = resolveComparisonBase({
    eventName: "pull_request",
    baseRef: "main",
    baseSha: "deadbeef",
    objectExists: (rev) => {
      seen.push(rev);
      return rev === "deadbeef";
    },
    mergeBase: (a, b) =>
      a === "HEAD" && b === "deadbeef" ? "merge-sha" : null,
  });
  assert.deepEqual(resolved, {
    ok: true,
    mergeBase: "merge-sha",
    resolvedFrom: "deadbeef",
  });
  assert.deepEqual(seen, ["deadbeef"]);
});

test("resolveComparisonBase falls back through origin/baseRef then full miss", () => {
  const shallow = resolveComparisonBase({
    eventName: "pull_request",
    baseRef: "main",
    baseSha: "not-fetched",
    objectExists: () => false,
    mergeBase: () => null,
  });
  assert.deepEqual(shallow, { ok: false, reason: "unresolved-base" });

  const fromOrigin = resolveComparisonBase({
    eventName: "pull_request",
    baseRef: "main",
    baseSha: undefined,
    objectExists: (rev) => rev === "origin/main",
    mergeBase: (a, b) =>
      a === "HEAD" && b === "origin/main" ? "from-origin" : null,
  });
  assert.deepEqual(fromOrigin, {
    ok: true,
    mergeBase: "from-origin",
    resolvedFrom: "origin/main",
  });

  assert.deepEqual(
    resolveComparisonBase({
      eventName: "push",
      baseRef: "main",
      baseSha: "abc",
      objectExists: () => true,
      mergeBase: () => "nope",
    }),
    { ok: false, reason: "not-pull-request" },
  );
});

test("Turbo cache persist skips untrusted fork PRs and allows same-repo / push", () => {
  assert.equal(
    shouldPersistTurboCache({
      eventName: "pull_request",
      headRepo: "outsider/showzy-v2",
      originRepo: "KurbatovIvann/showzy-v2",
    }),
    false,
  );
  assert.equal(
    shouldPersistTurboCache({
      eventName: "pull_request",
      headRepo: "KurbatovIvann/showzy-v2",
      originRepo: "KurbatovIvann/showzy-v2",
    }),
    true,
  );
  assert.equal(
    shouldPersistTurboCache({
      eventName: "push",
      headRepo: undefined,
      originRepo: "KurbatovIvann/showzy-v2",
    }),
    true,
  );
  assert.equal(
    shouldPersistTurboCache({
      eventName: "pull_request",
      headRepo: undefined,
      originRepo: "KurbatovIvann/showzy-v2",
    }),
    false,
  );
});
