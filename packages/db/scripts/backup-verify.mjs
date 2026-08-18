/**
 * Backup verify CLI (fnd-T28, db.md §6). Plain Node so CI does not depend
 * on TypeScript strip-types resolving `.js` → `.ts`. Behaviour is pinned
 * by `src/ops/backup-verify.test.ts` (the TypeScript module) and by
 * spawning this file for the dry-run gate.
 */
import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

const REDACTED = "[Redacted]";
const RPO_MINUTES = 15;
const RTO_HOURS = 4;
const ARCHIVE_TIMEOUT_SECONDS = RPO_MINUTES * 60;

function redactConnectionString(value) {
  return value.replace(/:([^:@/]+)@/, `:${REDACTED}@`);
}

function planLines() {
  return [
    "Showzy PostgreSQL backup plan (db.md §6)",
    `RPO: ≤ ${String(RPO_MINUTES)} minutes`,
    `RTO: ≤ ${String(RTO_HOURS)} hours`,
    "Tool: pgBackRest with an encrypted repository (WAL-G is an acceptable equivalent)",
    "Encryption: AES-256 at rest on off-host object storage (R2 SSE-S3 or SSE-C)",
    "Off-host: WAL + full backups leave the production VPS; repository lives in a separate cloud account",
    `Postgres: wal_level=replica archive_mode=on archive_timeout=${String(ARCHIVE_TIMEOUT_SECONDS)}s`,
    "Redis: rebuildable cache/rate-limit/adapter state — not backed up",
    "Restore drill: once before MVP launch, then quarterly",
    "Runbook: docs/operations/backups.md",
    "Restore drill: docs/operations/restore-drill.md",
  ];
}

function restoreSmoke() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl === "") {
    console.error("restore-smoke failed: DATABASE_URL is missing");
    return 1;
  }
  console.log(`restore-smoke target: ${redactConnectionString(databaseUrl)}`);
  const probe = process.platform === "win32" ? "where" : "which";
  if (spawnSync(probe, ["pg_dump"], { encoding: "utf8" }).status !== 0) {
    console.error("restore-smoke failed: pg_dump is not on PATH");
    return 1;
  }
  const dump = spawnSync(
    "pg_dump",
    ["--dbname", databaseUrl, "--format=custom", "--no-owner", "--schema-only"],
    { encoding: "utf8" },
  );
  console.log(
    `pg_dump status=${String(dump.status ?? 1)} stdout=${redactConnectionString(dump.stdout ?? "")} stderr=${redactConnectionString(dump.stderr ?? "")}`,
  );
  if (dump.status !== 0) {
    console.error("restore-smoke failed: pg_dump exited non-zero");
    return 1;
  }
  console.log(
    "restore-smoke: schema dump succeeded (PITR remains a production restore-drill)",
  );
  return 0;
}

const args = process.argv.slice(2);
const lines = planLines();
if (args.includes("--restore-smoke")) {
  for (const line of lines) {
    console.log(redactConnectionString(line));
  }
  process.exitCode = restoreSmoke();
} else {
  lines.push("mode: dry-run (no database connection)");
  for (const line of lines) {
    console.log(redactConnectionString(line));
  }
}
