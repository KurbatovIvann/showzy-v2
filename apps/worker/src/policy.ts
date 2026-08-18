/**
 * Worker loop parameters (fnd-T27). The notify channel is the db.md §4
 * trigger contract; intervals are operational defaults, not product
 * knobs — change them only through spec rework.
 */

/** Postgres NOTIFY channel fired on `domain_events` INSERT. */
export const OUTBOX_NOTIFY_CHANNEL = "domain_events";

/** Polling fallback when LISTEN is quiet (retries, expired claims). */
export const POLL_INTERVAL_MS = 1_000;

/** How often expired idempotency keys are deleted (core.md §5, 48h TTL). */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

/** First LISTEN reconnect delay after a dropped connection. */
export const LISTEN_RECONNECT_MIN_MS = 1_000;

/** Cap for exponential LISTEN reconnect backoff. */
export const LISTEN_RECONNECT_MAX_MS = 30_000;

/**
 * Heartbeat while LISTEN is down and the 1s poll is the only wakeup.
 * `docs/operations/alerts.md` pages SEV2 after this signal lasts > 5 min.
 */
export const LISTEN_DOWN_HEARTBEAT_MS = 60_000;
