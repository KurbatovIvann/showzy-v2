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
