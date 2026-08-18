import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BACKUP_RPO_MINUTES,
  BACKUP_RTO_HOURS,
  WAL_ARCHIVE_TIMEOUT_SECONDS,
  backupPolicy,
} from "./backup-policy.js";
import {
  dumpNullDevice,
  parseBackupVerifyMode,
  redactConnectionString,
  runBackupVerify,
} from "./backup-verify.js";

const SENTINEL = "BACKUP_PASSWORD_SENTINEL";
const URL_WITH_SECRET = `postgresql://showzy:${SENTINEL}@localhost:5432/showzy`;
const COLON_PASSWORD_URL =
  "postgresql://showzy:p:ass:word@localhost:5432/showzy";

describe("backup policy", () => {
  it("pins the db.md §6 RPO/RTO contract", () => {
    expect(BACKUP_RPO_MINUTES).toBe(15);
    expect(BACKUP_RTO_HOURS).toBe(4);
    expect(WAL_ARCHIVE_TIMEOUT_SECONDS).toBe(15 * 60);
    expect(backupPolicy.postgres.archiveTimeoutSeconds).toBe(15 * 60);
  });
});

describe("redactConnectionString", () => {
  it("strips the password from a Postgres URL", () => {
    expect(redactConnectionString(URL_WITH_SECRET)).not.toContain(SENTINEL);
    expect(redactConnectionString(URL_WITH_SECRET)).toContain("[Redacted]");
  });

  it("redacts a password that itself contains colons", () => {
    const redacted = redactConnectionString(COLON_PASSWORD_URL);
    expect(redacted).toBe(
      "postgresql://showzy:[Redacted]@localhost:5432/showzy",
    );
    expect(redacted).not.toContain("ass");
  });
});

describe("runBackupVerify", () => {
  it("dry-run exits ok, prints the plan, and never echoes DATABASE_URL secrets", () => {
    const logs: string[] = [];
    const result = runBackupVerify(["--dry-run"], {
      env: { DATABASE_URL: URL_WITH_SECRET },
      log: (line) => {
        logs.push(line);
      },
      hasCommand: () => {
        throw new Error("dry-run must not probe tools");
      },
      exec: () => {
        throw new Error("dry-run must not exec");
      },
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("dry-run");
    expect(parseBackupVerifyMode([])).toBe("dry-run");
    const output = [...result.lines, ...logs].join("\n");
    expect(output).toContain("RPO: ≤ 15 minutes");
    expect(output).toContain("RTO: ≤ 4 hours");
    expect(output).toContain("pgBackRest");
    expect(output).toContain("AES-256");
    expect(output).toContain("dry-run");
    expect(output).not.toContain(SENTINEL);
  });

  it("restore-smoke redacts the target URL and requires pg_dump", () => {
    const logs: string[] = [];
    const missing = runBackupVerify(["--restore-smoke"], {
      env: { DATABASE_URL: URL_WITH_SECRET },
      log: (line) => {
        logs.push(line);
      },
      hasCommand: () => false,
      exec: () => {
        throw new Error("must not exec when tools are missing");
      },
    });
    expect(missing.ok).toBe(false);
    expect(logs.join("\n")).not.toContain(SENTINEL);
    expect(logs.join("\n")).toContain("pg_dump is not on PATH");

    const execs: { file: string; args: readonly string[] }[] = [];
    const ok = runBackupVerify(["--restore-smoke"], {
      env: { DATABASE_URL: URL_WITH_SECRET },
      log: (line) => {
        logs.push(line);
      },
      hasCommand: () => true,
      dumpNullFile: dumpNullDevice("linux"),
      exec: (file, args) => {
        execs.push({ file, args });
        return { status: 0, stdout: "dump-ok-must-not-be-logged", stderr: "" };
      },
    });
    expect(ok.ok).toBe(true);
    expect(execs[0]?.file).toBe("pg_dump");
    expect(execs[0]?.args).toContain(URL_WITH_SECRET);
    expect(execs[0]?.args).toContain("--file");
    expect(execs[0]?.args).toContain("/dev/null");
    expect(logs.join("\n")).not.toContain(SENTINEL);
    expect(logs.join("\n")).not.toContain("dump-ok-must-not-be-logged");
    expect(logs.join("\n")).toContain("file=/dev/null");
  });
});

describe("backup:verify CLI (scripts/backup-verify.mjs)", () => {
  it("dry-run prints the spec numbers and never echoes DATABASE_URL secrets", () => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../../scripts/backup-verify.mjs", import.meta.url),
        ),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: URL_WITH_SECRET },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RPO: ≤ 15 minutes");
    expect(result.stdout).toContain("RTO: ≤ 4 hours");
    expect(result.stdout).toContain("dry-run");
    expect(result.stdout).not.toContain(SENTINEL);
    expect(result.stderr).not.toContain(SENTINEL);
  });
});
