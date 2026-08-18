# PostgreSQL backups (production)

> Owned by fnd-T28. Contract: `docs/specs/db.md` §6 (encrypted off-host
> backups with PITR; RPO ≤ 15 minutes, RTO ≤ 4 hours). Redis is
> rebuildable and is not backed up.

Production is a self-hosted Postgres 17 on the VPS (blueprint §3). This
file is the configuration baseline; credentials live in the host secret
store, never in git.

## Policy (pinned in `packages/db/src/ops/backup-policy.ts`)

| Control | Value |
| --- | --- |
| RPO | ≤ 15 minutes |
| RTO | ≤ 4 hours |
| Tool | pgBackRest with an encrypted repository (WAL-G is an acceptable equivalent) |
| Encryption | AES-256 at rest on off-host object storage (Cloudflare R2 SSE-S3 or SSE-C) |
| Off-host | WAL + full backups leave the production VPS; the repository is a separate cloud account |
| WAL | `wal_level=replica`, `archive_mode=on`, `archive_timeout=900` (15 minutes) so a quiet database still archives |
| Redis | Cache / rate-limit / adapter state only — rebuild on restore |
| Drill | Once before MVP launch, then quarterly (`docs/operations/restore-drill.md`) |

## Production stanza

Apply on the Postgres host (not in docker-compose). Values in `<>` are
host secrets.

```
wal_level = replica
archive_mode = on
archive_timeout = 900
archive_command = 'pgbackrest --stanza=showzy archive-push %p'
```

pgBackRest repository:

- `repo1-type=s3` pointing at the R2 bucket `showzy-pg-backups`
- `repo1-cipher-type=aes-256-cbc` (or R2 SSE-C) so data is encrypted
  before it leaves the VPS
- `repo1-retention-full=7` daily fulls; WAL between them provides PITR
- repository credentials are **not** the runtime `S3_*` document/chat
  keys — a backup-only IAM user, separate account

Full backups: `pgbackrest --stanza=showzy --type=full backup` daily via
the host scheduler. WAL push is continuous through `archive_command`.

## Local verify

Compose Postgres is a development volume, not PITR. The repo ships a
restoreability smoke:

```
pnpm --filter @showzy/db backup:verify -- --dry-run          # CI, no DB
pnpm --filter @showzy/db backup:verify -- --restore-smoke    # needs DATABASE_URL + pg_dump
```

`--dry-run` prints this plan and never connects. `--restore-smoke` runs
`pg_dump --schema-only` against `DATABASE_URL` and redacts the password
from every line. A passing smoke test is **not** a PITR drill — that is
`docs/operations/restore-drill.md`.
