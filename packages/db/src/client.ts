import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as auth from "./schema/auth.js";
import * as catalog from "./schema/catalog.js";
import * as companies from "./schema/companies.js";
import * as customers from "./schema/customers.js";
import * as foundation from "./schema/foundation.js";
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
  ...customers,
  ...orders,
  ...pricing,
};

export type DbSchema = typeof schema;
export type Database = NodePgDatabase<DbSchema>;

export interface CreateDbClientOptions {
  /**
   * Runtime-role connection string (`showzy_app` — db.md §6). Comes from
   * validated config (`@showzy/config`); this package never reads
   * `process.env`.
   */
  readonly databaseUrl: string;
  /** Pool size; default matches pg's own default. */
  readonly max?: number;
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
    ...(options.max !== undefined ? { max: options.max } : {}),
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
