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

/** First LISTEN reconnect delay after a dropped connection. */
export const LISTEN_RECONNECT_MIN_MS = 1_000;

/** Cap for exponential LISTEN reconnect backoff. */
export const LISTEN_RECONNECT_MAX_MS = 30_000;

/**
 * Heartbeat while LISTEN is down and the 1s poll is the only wakeup.
 * `docs/operations/alerts.md` pages SEV2 after this signal lasts > 5 min.
 */
export const LISTEN_DOWN_HEARTBEAT_MS = 60_000;
