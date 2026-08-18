# @showzy/worker — Agent Instructions

Outbox dispatcher and delivery executor process (fnd-T27). Core exposes
libraries only (`dispatchOutboxBatch`, `findClaimableDeliveries`,
`executeDelivery`, `cleanupExpiredIdempotencyKeys`); this package owns
the loops, LISTEN/NOTIFY wakeup, polling fallback, and graceful drain.

## Layout

- `src/index.ts` — process entry. `loadServerConfig()` once. Default
  command runs the worker; `replay-deliveries --consumer <id>` is the
  fnd-T18 admin replay CLI. An invalid environment crashes before work
  starts. Shutdown is latched (second SIGINT/SIGTERM is a no-op) and
  flushes Sentry before the process drains.
- `src/boot.ts` — opens Postgres + Redis, composes the action pipeline,
  LISTENs on `domain_events`, starts the loop.
- `src/loop.ts` — `createOutboxWorker` / `createWorkerLoop`: one tick
  dispatches then executes due deliveries; shutdown waits for in-flight
  work and does not claim further.
- `src/listen.ts` — dedicated `pg.Client` for `LISTEN domain_events`.
  A dropped listen connection reconnects with backoff, logs recovery, and
  emits `outbox listen down, poll-only` while degraded; the 1s poll is
  the fallback either way.
- `src/shutdown.ts` — SIGINT/SIGTERM latch so `close()` cannot run twice.
- `src/pipeline.ts` — fills every protocol hook slot (same composition
  as `apps/api`).
- `src/stores/redis.ts` — confirmation `GETDEL` and Lua token-bucket
  stores. Must stay behaviorally identical to `apps/api/src/stores/redis.ts`.
- `src/subscriptions.ts` — composition root for event subscriptions.
  Empty until modules exist; module tasks append their
  `defineEventHandler` bindings here.
- `src/observability.ts` — `createProcessObservability` (redacting pino
  logger + optional Sentry). Keep in lockstep with
  `apps/api/src/observability.ts`. `flushProcessObservability` drains
  Sentry on shutdown.
- `src/policy.ts` — poll/cleanup intervals and the notify channel name.
  Values change only through spec rework.

## Rules

- Config comes from `@showzy/config` at the entrypoint; this package
  never reads `process.env` except inside `loadServerConfig`.
- Do not query `domain_events` / `event_deliveries` directly — go
  through the core libraries.
- Domain event delivery is not BullMQ (ADR-0007/ADR-0012). BullMQ is
  for later execution jobs (PDF, email, push, sync).
- OTP codes, tokens, and secrets never reach logs. Process loggers are
  `createProcessLogger` from `@showzy/config`. Sentry is initialized
  only when `SENTRY_DSN` is set; `beforeSend` scrubs the event. Do not
  construct a raw `pino()`.
