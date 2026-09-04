#!/usr/bin/env node
/**
 * CI entrypoint for the `dependency-audit` job (SHO-387).
 *
 * The gate remains `pnpm audit --audit-level high` over the committed
 * lockfile. pnpm 10 posted to npm's retired `/security/audits/quick`
 * endpoint (socket timeout, then 410). pnpm 12 uses `/advisories/bulk`.
 * This wrapper still re-invokes the same command only when the failure
 * is a classified transient registry error.
 *
 * Advisory findings still fail on the first report. `--ignore-registry-errors`
 * is forbidden (that would skip the gate). GitHub Actions job-level
 * rerun-on-failure stays forbidden (SHO-145). `pnpm audit` does not
 * accept `--fetch-retries` / `--fetch-timeout`; those go on the process
 * env as `pnpm_config_*` (v11+ no longer reads `npm_config_*`).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const AUDIT_LEVEL = "high";

export const FETCH_TIMEOUT_MS = 90_000;

export const FETCH_RETRIES = 3;

export const MAX_PROCESS_ATTEMPTS = 3;

export const BACKOFF_MS = Object.freeze([5_000, 20_000]);

export const PNPM_AUDIT_ARGS = Object.freeze([
  "audit",
  "--audit-level",
  AUDIT_LEVEL,
]);

const TRANSIENT_TOKEN_RE =
  /ERR_SOCKET_TIMEOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|EAI_AGAIN|ENOTFOUND|socket timeout|Client network socket disconnected|operation timed out|error sending request for url/i;

const TRANSIENT_HTTP_RE =
  /(?:responded with |status(?: code)? |HTTP\/?\s*)(429|502|503|504)\b/i;

const RETIRED_ENDPOINT_RE =
  /This endpoint is being retired|responded with 410|Unknown options: 'fetch-retries'/i;

const ADVISORY_RE = /\d+\s+vulnerabilit(?:y|ies)\b/i;

/**
 * @param {string[]} argv
 */
export function parseAuditArgv(argv) {
  return { printOnly: argv.includes("--print-only") };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function auditProcessEnv(env) {
  return {
    ...env,
    pnpm_config_fetch_timeout: String(FETCH_TIMEOUT_MS),
    pnpm_config_fetch_retries: String(FETCH_RETRIES),
  };
}

/**
 * @param {string} text
 */
export function isTransientRegistryOutput(text) {
  return TRANSIENT_TOKEN_RE.test(text) || TRANSIENT_HTTP_RE.test(text);
}

/**
 * @param {{
 *   status: number | null | undefined,
 *   stdout?: string | null,
 *   stderr?: string | null,
 *   error?: { message?: string, code?: string } | null,
 * }} result
 * @returns {"ok" | "advisory" | "transient-registry" | "error"}
 */
export function classifyAuditResult(result) {
  if (result.status === 0 && !result.error) {
    return "ok";
  }

  const output = [result.stdout, result.stderr, result.error?.message]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join("\n");
  const errorCode =
    typeof result.error?.code === "string" ? result.error.code : "";

  if (RETIRED_ENDPOINT_RE.test(output)) {
    return "error";
  }
  if (ADVISORY_RE.test(output)) {
    return "advisory";
  }
  if (
    isTransientRegistryOutput(output) ||
    isTransientRegistryOutput(errorCode)
  ) {
    return "transient-registry";
  }
  return "error";
}

/**
 * @param {number} failedAttempt
 */
export function backoffAfterAttempt(failedAttempt) {
  return BACKOFF_MS[failedAttempt - 1];
}

/**
 * @param {number} ms
 */
function defaultSleepMs(ms) {
  if (ms <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * @param {{
 *   stdout?: string | null,
 *   stderr?: string | null,
 *   error?: { message?: string } | null,
 * }} result
 * @param {{
 *   stdoutWrite?: (chunk: string) => void,
 *   stderrWrite?: (chunk: string) => void,
 * }} io
 */
function replayOutput(result, io) {
  const stdoutWrite =
    io.stdoutWrite ?? ((chunk) => process.stdout.write(chunk));
  const stderrWrite =
    io.stderrWrite ?? ((chunk) => process.stderr.write(chunk));
  if (result.stdout) {
    stdoutWrite(result.stdout);
  }
  if (result.stderr) {
    stderrWrite(result.stderr);
  }
  if (result.error?.message) {
    stderrWrite(`${result.error.message}\n`);
  }
}

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   spawnSync?: typeof spawnSync,
 *   cwd?: string,
 *   sleepMs?: (ms: number) => void,
 *   stdoutWrite?: (chunk: string) => void,
 *   stderrWrite?: (chunk: string) => void,
 * }} [io]
 * @returns {number}
 */
export function runDependencyAudit(argv, env = process.env, io = {}) {
  const { printOnly } = parseAuditArgv(argv);
  const command = ["pnpm", ...PNPM_AUDIT_ARGS];

  if (printOnly) {
    console.log(
      JSON.stringify({
        command,
        maxProcessAttempts: MAX_PROCESS_ATTEMPTS,
        fetchTimeoutMs: FETCH_TIMEOUT_MS,
        fetchRetries: FETCH_RETRIES,
      }),
    );
    return 0;
  }

  const spawn = io.spawnSync ?? spawnSync;
  const sleepMs = io.sleepMs ?? defaultSleepMs;
  const stderrWrite =
    io.stderrWrite ?? ((chunk) => process.stderr.write(chunk));
  const auditEnv = auditProcessEnv(env);
  /** @type {number | null} */
  let lastStatus = null;

  for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt += 1) {
    const result = spawn("pnpm", [...PNPM_AUDIT_ARGS], {
      cwd: io.cwd,
      encoding: "utf8",
      env: auditEnv,
    });
    replayOutput(result, io);
    lastStatus = result.error ? 1 : (result.status ?? 1);
    const kind = classifyAuditResult(result);
    if (kind === "ok") {
      return 0;
    }
    if (kind !== "transient-registry") {
      return lastStatus;
    }
    const wait = backoffAfterAttempt(attempt);
    if (wait === undefined) {
      break;
    }
    stderrWrite(
      `Transient npm registry failure (attempt ${attempt}/${MAX_PROCESS_ATTEMPTS}); waiting ${wait}ms before a fresh audit process.\n`,
    );
    sleepMs(wait);
  }

  stderrWrite(
    `pnpm audit failed after ${MAX_PROCESS_ATTEMPTS} processes: npm registry still unreachable.\n`,
  );
  return lastStatus ?? 1;
}

const invoked =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invoked) {
  process.exitCode = runDependencyAudit(process.argv.slice(2));
}
