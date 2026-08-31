/**
 * SHO-278: idle-client `error` on the pg Pool must invoke the caller
 * handler and must not kill the process. Pool sizing/timeouts are
 * explicit and overridable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbClient,
  DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
  DEFAULT_POOL_IDLE_TIMEOUT_MS,
  DEFAULT_POOL_MAX,
} from "./client.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

const OFFLINE_URL = "postgresql://offline:offline@localhost:5432/offline";

async function waitUntil(
  check: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for pool error handler");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }
}

function requireConnectionString(pool: {
  options: { connectionString?: string };
}): string {
  const connectionString = pool.options.connectionString;
  if (connectionString === undefined || connectionString === "") {
    throw new Error("expected pool connectionString");
  }
  return connectionString;
}

describe("createDbClient pool options", () => {
  it("applies documented defaults in one place", async () => {
    const { pool } = createDbClient({ databaseUrl: OFFLINE_URL });
    try {
      expect(pool.options.max).toBe(DEFAULT_POOL_MAX);
      expect(pool.options.idleTimeoutMillis).toBe(DEFAULT_POOL_IDLE_TIMEOUT_MS);
      expect(pool.options.connectionTimeoutMillis).toBe(
        DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
      );
      expect(DEFAULT_POOL_MAX).toBe(10);
      expect(DEFAULT_POOL_IDLE_TIMEOUT_MS).toBe(10_000);
      expect(DEFAULT_POOL_CONNECTION_TIMEOUT_MS).toBe(10_000);
    } finally {
      await pool.end();
    }
  });

  it("overrides max, idle timeout, and connect timeout via options", async () => {
    const { pool } = createDbClient({
      databaseUrl: OFFLINE_URL,
      max: 3,
      idleTimeoutMillis: 1_500,
      connectionTimeoutMillis: 250,
    });
    try {
      expect(pool.options.max).toBe(3);
      expect(pool.options.idleTimeoutMillis).toBe(1_500);
      expect(pool.options.connectionTimeoutMillis).toBe(250);
    } finally {
      await pool.end();
    }
  });
});

describe("createDbClient idle pool error", () => {
  it("does not crash when an idle-client error is emitted without onPoolError", async () => {
    const { pool } = createDbClient({ databaseUrl: OFFLINE_URL });
    try {
      expect(pool.emit("error", new Error("idle-client reset"))).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("invokes onPoolError with the idle-client error", async () => {
    const seen: Error[] = [];
    const idleError = new Error("idle-client reset");
    const { pool } = createDbClient({
      databaseUrl: OFFLINE_URL,
      onPoolError: (error) => {
        seen.push(error);
      },
    });
    try {
      pool.emit("error", idleError);
      expect(seen).toEqual([idleError]);
    } finally {
      await pool.end();
    }
  });

  it("swallows a throwing onPoolError so the process stays alive", async () => {
    const { pool } = createDbClient({
      databaseUrl: OFFLINE_URL,
      onPoolError: () => {
        throw new Error("handler boom");
      },
    });
    try {
      expect(() => {
        pool.emit("error", new Error("idle-client reset"));
      }).not.toThrow();
    } finally {
      await pool.end();
    }
  });
});

describe("createDbClient idle backend terminate", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it("survives pg_terminate_backend on an idle connection and fires onPoolError", async () => {
    const seen: Error[] = [];
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => {
      uncaught.push(error);
    };
    process.on("uncaughtException", onUncaught);

    const client = createDbClient({
      databaseUrl: requireConnectionString(database.runtime.pool),
      max: 1,
      onPoolError: (error) => {
        seen.push(error);
      },
    });

    try {
      const held = await client.pool.connect();
      let pid: number;
      try {
        const result = await held.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new Error("expected pg_backend_pid");
        }
        pid = row.pid;
      } finally {
        held.release();
      }

      const terminated = await database.admin.query<{
        pg_terminate_backend: boolean;
      }>("SELECT pg_terminate_backend($1::int)", [pid]);
      expect(terminated.rows[0]?.pg_terminate_backend).toBe(true);

      await waitUntil(() => seen.length > 0);
      expect(seen[0]).toBeInstanceOf(Error);
      expect(uncaught).toEqual([]);
    } finally {
      process.off("uncaughtException", onUncaught);
      await client.pool.end();
    }
  });
});
