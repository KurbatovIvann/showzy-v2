# Restore drill

> Contract: `docs/specs/db.md` §6 — a restore drill must pass before MVP
> launch and then quarterly. Targets: RPO ≤ 15 minutes, RTO ≤ 4 hours.

This is the procedure. The local `--restore-smoke` script is a dump
probe, not this drill.

## Cadence

1. **Pre-launch** — pass once against a staging cluster restored from
   production-shaped backups (anonymized if it contains real personal
   data; security-operations §5).
2. **Quarterly** — same procedure, recorded as an incident-style note
   even on success (evidence that the drill happened).

## Targets

- **RPO** — restore to a timestamp ≤ 15 minutes behind "now". A quiet
  database still meets this because `archive_timeout=900`.
- **RTO** — from "declare restore" to "application health endpoint
  green on the restored cluster" ≤ 4 hours. Migrations are forward-only
  (db.md §6): restore the base backup, replay WAL to the target, then
  roll the application forward. Never apply a down migration.

## Procedure

1. **Declare.** Owner names severity (usually SEV2 if production is
   down), the PITR target time, and the restore host (never overwrite
   the live data directory in place).
2. **Preserve evidence.** Snapshot current logs, the failed host's
   data directory if it still mounts, and the backup repository
   listing. Do not rotate credentials yet if that would destroy forensic
   access — see `incident-response.md`.
3. **Provision a restore host** with Postgres 17 and the same
   pgBackRest stanza configuration (read-only repository credentials).
4. **Restore.** `pgbackrest --stanza=showzy --type=time "--target=<PITR timestamp>" restore`.
   Replay WAL to the target, then `pg_ctl start`.
5. **Reconcile.** Run `pnpm --filter @showzy/db db:migrate` against the
   restored cluster if the application is ahead of the backup; confirm
   `domain_events` / `event_deliveries` sequences are consistent (dead
   deliveries may be replayed per consumer — core.md §6). Redis is
   flushed and rebuilt.
6. **Verify.** `GET /health` on API; worker starts and claims no
   duplicate processed deliveries; one staff read action against a known
   company returns the expected row.
7. **Cut over** (production drill with outage) or **tear down**
   (scheduled quarterly drill).
8. **Record.** Time to restore, PITR target vs actual, gaps, follow-ups.
   A miss of RPO/RTO is a SEV2 process incident.

## Roles

The restore uses a **read-only** backup credential plus, on the restore
host only, a superuser to start Postgres. Runtime `showzy_app` is
attached after the cluster is up. `showzy_migrate` runs the roll-forward
step. Never restore as `showzy_app`.
