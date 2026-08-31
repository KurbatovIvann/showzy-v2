import { randomUUID } from "node:crypto";

import pg from "pg";
import { inject } from "vitest";

import { createDbClient, type DbClient } from "../client.js";
import type { DbHarnessContext } from "./context.js";

export interface TestDatabase {
  readonly name: string;
  readonly admin: pg.Client;
  readonly runtime: DbClient;
  close(): Promise<void>;
}

function databaseUrl(
  source: string,
  database: string,
  credentials?: { user: string; password: string },
): string {
  const url = new URL(source);
  url.pathname = `/${database}`;
  if (credentials !== undefined) {
    url.username = credentials.user;
    url.password = credentials.password;
  }
  return url.toString();
}

/**
 * Creates one migration-ready database per test file from the run-level
 * template. CREATE/DROP DATABASE are test-harness foundation primitives
 * approved by db.md §8; application assertions use the runtime role.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const context: DbHarnessContext = inject("dbHarness");
  const name = `showzy_test_${randomUUID().replaceAll("-", "")}`;
  const control = new pg.Client({
    connectionString: databaseUrl(context.adminUrl, "postgres"),
  });
  await control.connect();
  try {
    await control.query(
      `CREATE DATABASE "${name}" TEMPLATE "${context.templateDatabase}"`,
    );
  } finally {
    await control.end();
  }

  const admin = new pg.Client({
    connectionString: databaseUrl(context.adminUrl, name),
  });
  await admin.connect();
  const runtime = createDbClient({
    databaseUrl: databaseUrl(context.adminUrl, name, {
      user: context.runtimeRole,
      // Per-run randomUUID from global-setup — not the compose superuser
      // password and not a value stored in the repo.
      password: context.runtimePassword,
    }),
  });
  let closed = false;

  return {
    name,
    admin,
    runtime,
    async close() {
      if (closed) return;
      closed = true;
      await runtime.pool.end();
      await admin.end();

      const cleanup = new pg.Client({
        connectionString: databaseUrl(context.adminUrl, "postgres"),
      });
      await cleanup.connect();
      try {
        await cleanup.query(`DROP DATABASE "${name}"`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
