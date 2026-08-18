/**
 * Backup verify CLI (fnd-T28, db.md §6).
 *
 * `--dry-run` (default) prints the production PITR plan and never
 * connects to Postgres — that is the CI gate. `--restore-smoke` runs
 * `pg_dump --schema-only --file <null-device>` against `DATABASE_URL`
 * when `pg_dump` is on PATH; connection passwords are stripped from
 * every log line via `@showzy/config` userinfo redaction.
 */
import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

import { redactText } from "@showzy/config";

import { backupPolicy } from "./backup-policy.js";

export type BackupVerifyMode = "dry-run" | "restore-smoke";

export interface CommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface BackupVerifyDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly log: (line: string) => void;
  readonly hasCommand: (name: string) => boolean;
  readonly exec: (file: string, args: readonly string[]) => CommandResult;
  readonly dumpNullFile?: string;
}

export interface BackupVerifyResult {
  readonly ok: boolean;
  readonly mode: BackupVerifyMode;
  readonly lines: readonly string[];
}

export function dumpNullDevice(
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? "NUL" : "/dev/null";
}

export function redactConnectionString(value: string): string {
  return redactText(value);
}

export function parseBackupVerifyMode(
  args: readonly string[],
): BackupVerifyMode {
  if (args.includes("--restore-smoke")) {
    return "restore-smoke";
  }
  return "dry-run";
}

function defaultHasCommand(name: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [name], { encoding: "utf8" });
  return result.status === 0;
}

function defaultExec(file: string, args: readonly string[]): CommandResult {
  const result = spawnSync(file, [...args], { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function defaultBackupVerifyDeps(): BackupVerifyDeps {
  return {
    env: process.env,
    log: (line) => {
      console.log(line);
    },
    hasCommand: defaultHasCommand,
    exec: defaultExec,
    dumpNullFile: dumpNullDevice(),
  };
}

function planLines(): string[] {
  return [
    "Showzy PostgreSQL backup plan (db.md §6)",
    `RPO: ≤ ${String(backupPolicy.rpoMinutes)} minutes`,
    `RTO: ≤ ${String(backupPolicy.rtoHours)} hours`,
    `Tool: ${backupPolicy.tool}`,
    `Encryption: ${backupPolicy.encryption}`,
    `Off-host: ${backupPolicy.offHost}`,
    `Postgres: wal_level=${backupPolicy.postgres.walLevel} archive_mode=${backupPolicy.postgres.archiveMode} archive_timeout=${String(backupPolicy.postgres.archiveTimeoutSeconds)}s`,
    `Redis: ${backupPolicy.redis}`,
    `Restore drill: ${backupPolicy.restoreDrill}`,
    "Runbook: docs/operations/backups.md",
    "Restore drill: docs/operations/restore-drill.md",
  ];
}

function restoreSmoke(
  deps: BackupVerifyDeps,
  lines: string[],
): BackupVerifyResult {
  const databaseUrl = deps.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl === "") {
    lines.push("restore-smoke failed: DATABASE_URL is missing");
    return { ok: false, mode: "restore-smoke", lines };
  }
  const safeUrl = redactConnectionString(databaseUrl);
  lines.push(`restore-smoke target: ${safeUrl}`);
  if (!deps.hasCommand("pg_dump")) {
    lines.push("restore-smoke failed: pg_dump is not on PATH");
    return { ok: false, mode: "restore-smoke", lines };
  }

  const dumpFile = deps.dumpNullFile ?? dumpNullDevice();
  const dump = deps.exec("pg_dump", [
    "--dbname",
    databaseUrl,
    "--format=custom",
    "--no-owner",
    "--schema-only",
    "--file",
    dumpFile,
  ]);
  lines.push(`pg_dump status=${String(dump.status)} file=${dumpFile}`);
  if (dump.status !== 0) {
    if (dump.stderr !== "") {
      lines.push(`pg_dump stderr=${redactConnectionString(dump.stderr)}`);
    }
    lines.push("restore-smoke failed: pg_dump exited non-zero");
    return { ok: false, mode: "restore-smoke", lines };
  }
  lines.push(
    "restore-smoke: schema dump succeeded (PITR remains a production restore-drill)",
  );
  return { ok: true, mode: "restore-smoke", lines };
}

export function runBackupVerify(
  args: readonly string[],
  deps: BackupVerifyDeps = defaultBackupVerifyDeps(),
): BackupVerifyResult {
  const mode = parseBackupVerifyMode(args);
  const lines = planLines();
  if (mode === "dry-run") {
    lines.push("mode: dry-run (no database connection)");
    for (const line of lines) {
      deps.log(redactConnectionString(line));
    }
    return { ok: true, mode, lines };
  }
  const result = restoreSmoke(deps, lines);
  for (const line of result.lines) {
    deps.log(redactConnectionString(line));
  }
  return result;
}
