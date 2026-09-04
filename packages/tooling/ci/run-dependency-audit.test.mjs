import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUDIT_LEVEL,
  BACKOFF_MS,
  FETCH_RETRIES,
  FETCH_TIMEOUT_MS,
  MAX_PROCESS_ATTEMPTS,
  PNPM_AUDIT_ARGS,
  auditProcessEnv,
  classifyAuditResult,
  parseAuditArgv,
  runDependencyAudit,
} from "./run-dependency-audit.mjs";

const script = fileURLToPath(
  new URL("./run-dependency-audit.mjs", import.meta.url),
);

const SOCKET_TIMEOUT_LOG = `WARN POST https://registry.npmjs.org/-/npm/v1/security/audits/quick error (ERR_SOCKET_TIMEOUT). Will retry in 10 seconds. 2 retries left.
WARN POST https://registry.npmjs.org/-/npm/v1/security/audits/quick error (ERR_SOCKET_TIMEOUT). Will retry in 1 minute. 1 retries left.
ERR_SOCKET_TIMEOUT request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: Socket timeout
`;

function mockIo(spawnImpl) {
  const sleeps = [];
  const stdout = [];
  const stderr = [];
  const calls = [];
  return {
    sleeps,
    stdout,
    stderr,
    calls,
    io: {
      spawnSync: (command, args, options) => {
        calls.push({ command, args, options });
        return spawnImpl(command, args, options, calls.length);
      },
      sleepMs: (ms) => {
        sleeps.push(ms);
      },
      stdoutWrite: (chunk) => {
        stdout.push(chunk);
      },
      stderrWrite: (chunk) => {
        stderr.push(chunk);
      },
    },
  };
}

test("parseAuditArgv and print-only keep the high audit-level command", () => {
  assert.deepEqual(parseAuditArgv([]), { printOnly: false });
  assert.deepEqual(parseAuditArgv(["--print-only"]), { printOnly: true });
  assert.deepEqual(PNPM_AUDIT_ARGS, ["audit", "--audit-level", AUDIT_LEVEL]);
  assert.equal(AUDIT_LEVEL, "high");
  assert.ok(!PNPM_AUDIT_ARGS.includes("--ignore-registry-errors"));
  assert.ok(!PNPM_AUDIT_ARGS.includes("--fetch-retries"));
  assert.ok(!PNPM_AUDIT_ARGS.includes("--fetch-timeout"));
});

test("classifyAuditResult treats the SHO-387 socket timeout log as transient", () => {
  assert.equal(
    classifyAuditResult({ status: 1, stdout: "", stderr: SOCKET_TIMEOUT_LOG }),
    "transient-registry",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "GET https://registry.npmjs.org/foo error (ECONNRESET).\n",
    }),
    "transient-registry",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: `Error: ERR_PNPM_AUDIT_BAD_RESPONSE

  × Failed to request the audit endpoint (at https://registry.npmjs.org/-/npm/
  │ v1/security/advisories/bulk): error sending request for url (https://
  │ registry.npmjs.org/-/npm/v1/security/advisories/bulk)
  ╰─▶ operation timed out
`,
    }),
    "transient-registry",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "The audit endpoint responded with 503 Service Unavailable\n",
    }),
    "transient-registry",
  );
});

test("classifyAuditResult fails closed on advisories, 410, and unknown errors", () => {
  assert.equal(
    classifyAuditResult({
      status: 0,
      stdout: "No known vulnerabilities found\n",
      stderr: "",
    }),
    "ok",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "2 vulnerabilities found\n",
      stderr: "",
    }),
    "advisory",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "ERROR  Unknown options: 'fetch-retries', 'fetch-timeout'\n",
    }),
    "error",
  );
  assert.equal(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "pnpm: command not found\n",
    }),
    "error",
  );
  assert.equal(
    classifyAuditResult({
      status: null,
      error: { message: "connect ETIMEDOUT", code: "ETIMEDOUT" },
    }),
    "transient-registry",
  );
  assert.equal(
    classifyAuditResult({
      status: null,
      error: { message: "spawn pnpm ENOENT", code: "ENOENT" },
    }),
    "error",
  );
});

test("runDependencyAudit re-invokes after socket timeout and succeeds", () => {
  const { io, calls, sleeps } = mockIo((_command, _args, _options, n) => {
    if (n === 1) {
      return { status: 1, stdout: "", stderr: SOCKET_TIMEOUT_LOG };
    }
    return {
      status: 0,
      stdout: "No known vulnerabilities found\n",
      stderr: "",
    };
  });

  assert.equal(runDependencyAudit([], {}, io), 0);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [BACKOFF_MS[0]]);
  assert.equal(calls[0].command, "pnpm");
  assert.deepEqual(calls[0].args, [...PNPM_AUDIT_ARGS]);
  assert.equal(
    calls[0].options.env.pnpm_config_fetch_timeout,
    String(FETCH_TIMEOUT_MS),
  );
});

test("runDependencyAudit fails immediately on advisory findings", () => {
  const { io, calls, sleeps } = mockIo(() => ({
    status: 1,
    stdout: "1 vulnerability found\n",
    stderr: "",
  }));

  assert.equal(runDependencyAudit([], {}, io), 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test("runDependencyAudit fails immediately on a retired audit endpoint", () => {
  const { io, calls, sleeps } = mockIo(() => ({
    status: 1,
    stdout: "",
    stderr:
      "ERR_PNPM_AUDIT_BAD_RESPONSE  The audit endpoint responded with 410: This endpoint is being retired.\n",
  }));

  assert.equal(runDependencyAudit([], {}, io), 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test("runDependencyAudit exits non-zero after exhausting transient registry failures", () => {
  const { io, calls, sleeps } = mockIo(() => ({
    status: 1,
    stdout: "",
    stderr: SOCKET_TIMEOUT_LOG,
  }));

  assert.equal(runDependencyAudit([], {}, io), 1);
  assert.equal(calls.length, MAX_PROCESS_ATTEMPTS);
  assert.deepEqual(sleeps, [...BACKOFF_MS]);
});

test("auditProcessEnv preserves caller env and sets fetch budget", () => {
  const env = auditProcessEnv({ PATH: "/usr/bin", CI: "true" });
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.CI, "true");
  assert.equal(env.pnpm_config_fetch_retries, String(FETCH_RETRIES));
  assert.equal(env.pnpm_config_fetch_timeout, String(FETCH_TIMEOUT_MS));
});

test("CLI print-only exits 0 and does not spawn pnpm", () => {
  const result = spawnSync(process.execPath, [script, "--print-only"], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout.trim());
  assert.deepEqual(payload.command, ["pnpm", ...PNPM_AUDIT_ARGS]);
  assert.equal(payload.maxProcessAttempts, MAX_PROCESS_ATTEMPTS);
  assert.ok(!payload.command.includes("--ignore-registry-errors"));
  assert.ok(!payload.command.includes("--fetch-retries"));
  assert.ok(!payload.command.includes("--fetch-timeout"));
});
