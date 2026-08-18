# Alert list

> Wiring notes for security-operations §6. Phase 0 ships structured
> log lines and Sentry issues; a paging vendor is chosen at launch
> (fnd-G1). Filter on these events. Raw IPs, OTPs, tokens, and
> payloads must never appear in the alert body — redaction is in
> `packages/config` (`createProcessLogger` / `scrubTelemetryEvent`).

| Alert | Signal | Severity | Where it is emitted today |
| --- | --- | --- | --- |
| **Dead event deliveries** | Log `event delivery dead-lettered` (`consumer`, `event_id`, `attempts`, `error_code`) | SEV3 per consumer; SEV2 if several consumers on the same event stay dead | `packages/core` delivery retry (fnd-T18) |
| **Rate-limit abuse** | Sustained `RateLimitError` on `public` / auth endpoints; store-down error log on fail-open reads | SEV3; SEV2 if it looks like credential stuffing (auth actions) | Pipeline rate-limit hook (fnd-T14). Raw IP is never the key or a log field |
| **Elevated 5xx / INTERNAL** | HTTP 5xx at the transport; log `action finished` with `outcome=INTERNAL`; Sentry event from `createErrorTelemetry` | SEV2; SEV1 if the error is a tenant-scope `CoreInvariantError` | API/worker process logger + Sentry (fnd-T28) |
| **Backup failure** | pgBackRest/cron non-zero; missing WAL for > RPO; `--restore-smoke` red in a scheduled job | SEV2 | Host scheduler around `docs/operations/backups.md`. CI only runs `--dry-run` |
| **Cross-tenant invariant failure** | `CoreInvariantError` mentioning company/tenant/principal mismatch; isolation-suite failure in CI on `main` | SEV1 in production; merge-block in CI | Core factories/pipeline; inherited `crossTenantSuite` (fnd-T21/T22) |
| **Queue exhaustion** | Worker `outbox delivery failed` / `threw` rates climbing; listen connection errors with poll-only fallback for > 5 minutes | SEV2 | `apps/worker` loop (fnd-T27) |
| **Payment/provider reconciliation** | Placeholder until fnd-T45–T47. Wire to `payments.statusChanged` mismatches when that slice lands | SEV2 | Not yet emitting |

## Sentry

`apps/api` and `apps/worker` call `Sentry.init` only when `SENTRY_DSN`
is set. `sendDefaultPii: false`. `beforeSend` runs `scrubTelemetryEvent`.
Pipeline failures call `span.recordError` and flush on `end` with
`request_id` / `action` / actor / company tags (null company for
public-global, consumer, account, and global system).

## What not to alert on

Expected client outcomes (`VALIDATION`, `PERMISSION_DENIED`,
`NOT_FOUND`, `CONFLICT`, `CONFIRMATION_REQUIRED`) are log lines, not
pages. Confirmation and idempotency conflicts are caller bugs, not
availability incidents.
