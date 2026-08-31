/**
 * Shared identifier patterns — one source so the context factories, the
 * emit buffer, and the event tooling cannot drift from each other.
 */

/** Canonical 8-4-4-4-12 UUID — row ids and selectors (db.md §4). */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `<module>.<kebab-name>` consumer id (core.md §6, e.g.
 * "chat.order-card-updater") — the module segment matches action/event
 * naming; the consumer segment is lower-case kebab.
 */
export const CONSUMER_NAME_PATTERN =
  /^[a-z][a-zA-Z0-9]*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
