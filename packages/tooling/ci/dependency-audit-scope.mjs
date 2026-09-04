#!/usr/bin/env node
/**
 * Decide whether the `dependency-audit` job should call `pnpm audit`.
 *
 * The GitHub job always runs and reports success so the `checks` aggregator
 * and required-check names stay valid (SHO-334). Hitting npm's bulk advisory
 * endpoint is only necessary when the committed dependency graph may have
 * changed: lockfile, workspace config, any `package.json`, or `.npmrc`.
 *
 * Unresolved comparison SHAs fail closed (run the audit). Do not pass
 * `--ignore-registry-errors`.
 */
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { gitMergeBase, gitObjectExists } from "./run-turbo.mjs";
import { resolveComparisonBase } from "./turbo-execution-mode.mjs";

export const DEPENDENCY_AUDIT_BASENAMES = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
]);

const AUDIT_BASENAME_SET = new Set(DEPENDENCY_AUDIT_BASENAMES);

/**
 * @param {string | undefined} sha
 */
export function isAbsentSha(sha) {
  return sha === undefined || sha === "" || /^0+$/.test(sha);
}

/**
 * @param {string} filePath
 */
export function pathAffectsDependencyAudit(filePath) {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  const slash = normalized.lastIndexOf("/");
  const basename = slash < 0 ? normalized : normalized.slice(slash + 1);
  return AUDIT_BASENAME_SET.has(basename);
}

/**
 * @param {readonly string[]} changedPaths
 * @returns {{ audit: boolean, reason: string, changed: string[] }}
 */
export function decideFromChangedPaths(changedPaths) {
  const changed = changedPaths.filter(pathAffectsDependencyAudit);
  if (changed.length === 0) {
    return { audit: false, reason: "manifest-unchanged", changed: [] };
  }
  return { audit: true, reason: "manifest-changed", changed };
}

/**
 * @param {string} base
 * @param {{ spawnSync?: typeof spawnSync, cwd?: string }} [io]
 * @returns {{ ok: true, names: string[] } | { ok: false, stderr: string }}
 */
export function gitDiffNames(base, io = {}) {
  const spawn = io.spawnSync ?? spawnSync;
  const result = spawn(
    "git",
    ["diff", "--name-only", "--diff-filter=ACDMRT", `${base}...HEAD`],
    { cwd: io.cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    return {
      ok: false,
      stderr: `${result.stderr ?? ""}${result.error?.message ?? ""}`,
    };
  }
  const names = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { ok: true, names };
}

/**
 * @param {string[]} argv
 */
export function parseScopeArgv(argv) {
  return { printOnly: argv.includes("--print-only") };
}

/**
 * @param {{
 *   audit: boolean,
 *   reason: string,
 *   changed?: string[],
 * }} decision
 * @param {NodeJS.ProcessEnv} env
 * @param {{
 *   appendFileSync?: typeof appendFileSync,
 *   stdoutWrite?: (chunk: string) => void,
 * }} [io]
 */
export function writeScopeResult(decision, env, io = {}) {
  const run = decision.audit ? "true" : "false";
  if (env.GITHUB_OUTPUT) {
    const write = io.appendFileSync ?? appendFileSync;
    write(env.GITHUB_OUTPUT, `run=${run}\n`);
  }
  const stdoutWrite =
    io.stdoutWrite ?? ((chunk) => process.stdout.write(chunk));
  if (decision.audit) {
    stdoutWrite(`dependency-audit: run pnpm audit (${decision.reason})\n`);
    if (decision.changed && decision.changed.length > 0) {
      stdoutWrite(`changed: ${decision.changed.join(", ")}\n`);
    }
  } else {
    stdoutWrite(
      `dependency-audit: no lockfile or manifest changes (${decision.reason})\n`,
    );
  }
  return { ...decision, run: decision.audit };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   spawnSync?: typeof spawnSync,
 *   cwd?: string,
 *   appendFileSync?: typeof appendFileSync,
 *   stdoutWrite?: (chunk: string) => void,
 * }} [io]
 */
export function runDependencyAuditScope(env = process.env, io = {}) {
  const eventName = env.GITHUB_EVENT_NAME ?? "";
  const spawn = io.spawnSync ?? spawnSync;
  const gitIo = { spawnSync: spawn, cwd: io.cwd };

  if (eventName === "workflow_dispatch") {
    return writeScopeResult(
      { audit: true, reason: "workflow_dispatch" },
      env,
      io,
    );
  }

  const comparison = resolveAuditComparison(eventName, env, gitIo);
  if (!comparison.ok) {
    return writeScopeResult(
      { audit: true, reason: comparison.reason },
      env,
      io,
    );
  }

  const diff = gitDiffNames(comparison.rev, gitIo);
  if (!diff.ok) {
    return writeScopeResult({ audit: true, reason: "diff-failed" }, env, io);
  }
  return writeScopeResult(decideFromChangedPaths(diff.names), env, io);
}

/**
 * @param {string} eventName
 * @param {NodeJS.ProcessEnv} env
 * @param {{ spawnSync?: typeof spawnSync, cwd?: string }} gitIo
 * @returns {{ ok: true, rev: string } | { ok: false, reason: string }}
 */
function resolveAuditComparison(eventName, env, gitIo) {
  if (eventName === "pull_request") {
    const resolved = resolveComparisonBase({
      eventName,
      baseRef: env.GITHUB_BASE_REF,
      baseSha: env.PR_BASE_SHA,
      objectExists: (rev) => gitObjectExists(rev, gitIo),
      mergeBase: (a, b) => gitMergeBase(a, b, gitIo),
    });
    if (!resolved.ok) {
      return { ok: false, reason: "unresolved-base" };
    }
    return { ok: true, rev: resolved.mergeBase };
  }
  if (eventName === "push") {
    const before = env.PUSH_BEFORE_SHA;
    if (isAbsentSha(before) || !gitObjectExists(before, gitIo)) {
      return { ok: false, reason: "unresolved-before" };
    }
    return { ok: true, rev: before };
  }
  return { ok: false, reason: "unknown-event" };
}

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 * @param {Parameters<typeof runDependencyAuditScope>[1]} [io]
 */
export function runScopeCli(argv, env = process.env, io = {}) {
  const { printOnly } = parseScopeArgv(argv);
  const decision = runDependencyAuditScope(
    env,
    printOnly ? { ...io, stdoutWrite: () => {} } : io,
  );
  if (printOnly) {
    const stdoutWrite =
      io.stdoutWrite ?? ((chunk) => process.stdout.write(chunk));
    stdoutWrite(
      `${JSON.stringify({
        run: decision.audit,
        reason: decision.reason,
        changed: decision.changed ?? [],
      })}\n`,
    );
  }
  return 0;
}

const invoked =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invoked) {
  process.exitCode = runScopeCli(process.argv.slice(2));
}
