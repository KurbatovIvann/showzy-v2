import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as auth from "./schema/auth.js";
import * as catalog from "./schema/catalog.js";
import * as chat from "./schema/chat.js";
import * as companies from "./schema/companies.js";
import * as customers from "./schema/customers.js";
import * as docGeneration from "./schema/doc-generation.js";
import * as docSigning from "./schema/doc-signing.js";
import * as documents from "./schema/documents.js";
import * as files from "./schema/files.js";
import * as foundation from "./schema/foundation.js";
import * as invites from "./schema/invites.js";
import * as orders from "./schema/orders.js";
import * as pricing from "./schema/pricing.js";

/**
 * Aggregated Drizzle schema. Module schema files are spread in here as their
 * schema tasks land (ADR-0014); modules themselves import only their own
 * `@showzy/db/schema/<module>` file — this aggregate exists for the client
 * factory and relational queries.
 */
export const schema = {
  ...foundation,
  ...auth,
  ...companies,
  ...catalog,
  ...chat,
  ...customers,
  ...docGeneration,
  ...docSigning,
  ...documents,
  ...files,
  ...invites,
  ...orders,
  ...pricing,
};

export type DbSchema = typeof schema;
export type Database = NodePgDatabase<DbSchema>;

/**
 * pg's own default `max`. Passed explicitly so pool sizing is not an
 * implicit library default (SHO-278).
 */
export const DEFAULT_POOL_MAX = 10;

/**
 * pg's own default idle timeout. Passed explicitly so idle-client lifetime
 * is visible in one place (SHO-278).
 */
export const DEFAULT_POOL_IDLE_TIMEOUT_MS = 10_000;

/**
 * Finite connect timeout. pg defaults `connectionTimeoutMillis` to 0 (wait
 * forever); a hung Postgres must fail the checkout instead (SHO-278).
 */
export const DEFAULT_POOL_CONNECTION_TIMEOUT_MS = 10_000;

export interface CreateDbClientOptions {
  /**
   * Runtime-role connection string (`showzy_app` — db.md §6). Comes from
   * validated config (`@showzy/config`); this package never reads
   * `process.env`.
   */
  readonly databaseUrl: string;
  /** Pool size. Defaults to {@link DEFAULT_POOL_MAX}. */
  readonly max?: number;
  /**
   * Milliseconds an idle client stays in the pool. Defaults to
   * {@link DEFAULT_POOL_IDLE_TIMEOUT_MS}.
   */
  readonly idleTimeoutMillis?: number;
  /**
   * Milliseconds to wait when checking out a new client. Defaults to
   * {@link DEFAULT_POOL_CONNECTION_TIMEOUT_MS} (pg's implicit 0 waits
   * forever).
   */
  readonly connectionTimeoutMillis?: number;
  /**
   * Called when an idle pooled client emits `error` (failover, network
   * reset, `pg_terminate_backend`). The factory always attaches a pool
   * `error` listener so Node does not treat the event as an uncaught
   * exception. This package does not log — callers pass their logger.
   */
  readonly onPoolError?: (error: Error) => void;
}

export interface DbClient {
  readonly db: Database;
  /** Exposed for lifecycle control (graceful shutdown) and the test harness. */
  readonly pool: pg.Pool;
}

/** Creates the pg Pool + Drizzle client pair. One per process, closed on shutdown. */
export function createDbClient(options: CreateDbClientOptions): DbClient {
  const pool = new pg.Pool({
    connectionString: options.databaseUrl,
    max: options.max ?? DEFAULT_POOL_MAX,
    idleTimeoutMillis:
      options.idleTimeoutMillis ?? DEFAULT_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis:
      options.connectionTimeoutMillis ?? DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
  });
  // Idle-client errors are emitted on the pool. Without a listener Node
  // treats that as an uncaught exception and the process dies (SHO-278).
  pool.on("error", (error) => {
    try {
      options.onPoolError?.(error);
    } catch {
      // A throwing callback must not become an uncaught exception.
    }
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
