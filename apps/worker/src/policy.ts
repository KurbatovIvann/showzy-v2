/**
 * Worker loop and job-host parameters (fnd-T27 / fnd-T29). The notify
 * channel is the db.md §4 trigger contract; BullMQ prefix/queue and
 * intervals are operational defaults, not product knobs — change them
 * only through an ADR or a protocol-manual patch with a proving test.
 */

/** Postgres NOTIFY channel fired on `domain_events` INSERT. */
export const OUTBOX_NOTIFY_CHANNEL = "domain_events";

/** Polling fallback when LISTEN is quiet (retries, expired claims). */
export const POLL_INTERVAL_MS = 1_000;

/**
 * How often the maintenance Job Scheduler runs idempotency-key expiry
 * (core.md §5, 48h TTL). BullMQ, not `setInterval`.
 */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

/**
 * How often the maintenance Job Scheduler runs
 * `files.sweepAbandonedUploads` (SHO-120). BullMQ, not `setInterval`.
 */
export const SWEEP_INTERVAL_MS = 5 * 60 * 1_000;

/**
 * Rows requested per `files.sweepAbandonedUploads` call. Must not exceed
 * the action's input ceiling (20) — a larger value fails input validation
 * loudly on the first tick.
 */
export const SWEEP_BATCH_SIZE = 20;

/**
 * Ceiling on sweep batches per scheduler tick. A full batch signals more
 * backlog, so the processor keeps sweeping within the tick instead of
 * waiting 5 minutes per 20 rows (audit follow-up: one flooding client can
 * create pending rows far faster than 20 per 5 minutes). 25 batches ×
 * 20 rows every 5 minutes clears 144 000 rows/day; a remainder is picked
 * up by the next tick.
 */
export const SWEEP_MAX_BATCHES_PER_TICK = 25;

/**
 * Retry budget for failed maintenance jobs. Both jobs are idempotent
 * (cleanup is a bounded DELETE; sweep batches reuse per-batch idempotency
 * keys, and core re-executes a `failed` reservation on takeover), so a
 * transient Redis/Postgres/S3 error retries within the tick instead of
 * waiting for the next schedule (1 h for cleanup).
 */
export const MAINTENANCE_JOB_ATTEMPTS = 3;

/** First retry delay; BullMQ doubles it per attempt (5s, 10s). */
export const MAINTENANCE_JOB_BACKOFF_MS = 5_000;

/**
 * BullMQ Redis key prefix (ADR-0007). Do not set ioredis `keyPrefix` —
 * BullMQ owns prefixing. Do not add pdf/email/push/sms/sync queues here.
 */
export const BULLMQ_PREFIX = "showzy";

/** Sole execution queue in this slice. Outbox delivery is not BullMQ. */
export const MAINTENANCE_QUEUE_NAME = "maintenance";

/**
 * Stable Job Scheduler id and job name. Re-upserted on every boot so a
 * flushed Redis only misses ticks (db.md §6: Redis is rebuildable).
 */
export const IDEMPOTENCY_CLEANUP_JOB_NAME = "cleanupExpiredIdempotencyKeys";

/**
 * Second Job Scheduler on the same `maintenance` queue (SHO-120).
 * Do not add a second queue.
 */
export const SWEEP_ABANDONED_UPLOADS_JOB_NAME = "sweepAbandonedUploads";

/**
 * System actor for maintenance jobs that invoke registered actions.
 * Not a new principal — `system` + `systemScope: "global"`.
 */
export const MAINTENANCE_SERVICE_NAME = "worker.maintenance";

/**
 * Worker lock longer than `files.sweepAbandonedUploads` timeout (30s)
 * so a replica cannot steal an in-flight sweep.
 */
export const MAINTENANCE_LOCK_DURATION_MS = 60_000;

/** First LISTEN reconnect delay after a dropped connection. */
export const LISTEN_RECONNECT_MIN_MS = 1_000;

/** Cap for exponential LISTEN reconnect backoff. */
export const LISTEN_RECONNECT_MAX_MS = 30_000;

/**
 * Heartbeat while LISTEN is down and the 1s poll is the only wakeup.
 * `docs/operations/alerts.md` pages SEV2 after this signal lasts > 5 min.
 */
export const LISTEN_DOWN_HEARTBEAT_MS = 60_000;
