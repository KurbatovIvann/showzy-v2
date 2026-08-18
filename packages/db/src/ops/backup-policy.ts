/**
 * Foundation backup policy (db.md §6). Numbers are the Active spec
 * contract — change only through spec rework. The verify CLI and the
 * runbook in `docs/operations/` print these values so they cannot drift.
 */
export const BACKUP_RPO_MINUTES = 15;
export const BACKUP_RTO_HOURS = 4;

/** WAL archive_timeout so a quiet database still meets RPO. */
export const WAL_ARCHIVE_TIMEOUT_SECONDS = BACKUP_RPO_MINUTES * 60;

export const backupPolicy = Object.freeze({
  rpoMinutes: BACKUP_RPO_MINUTES,
  rtoHours: BACKUP_RTO_HOURS,
  walArchiveTimeoutSeconds: WAL_ARCHIVE_TIMEOUT_SECONDS,
  encryption: "AES-256 at rest on off-host object storage (R2 SSE-S3 or SSE-C)",
  tool: "pgBackRest with an encrypted repository (WAL-G is an acceptable equivalent)",
  postgres: {
    walLevel: "replica",
    archiveMode: "on",
    archiveTimeoutSeconds: WAL_ARCHIVE_TIMEOUT_SECONDS,
  },
  redis: "rebuildable cache/rate-limit/adapter state — not backed up",
  restoreDrill: "once before MVP launch, then quarterly",
  offHost:
    "WAL + full backups leave the production VPS; repository lives in a separate cloud account",
});
