/**
 * SHO-240: 0029 must add `orders.order_number` onto tables that 0013
 * created without it. Empty-DB apply is the harness template (all
 * migrations). This file proves the SQL backfill and a DB that already
 * has pre-0029 order rows (documents 0028 applied; this ticket's
 * migration excluded).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDbClient } from "./client.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);
const orderNumberMigrationSql = readFileSync(
  path.join(migrationsFolder, "0029_uneven_arclight.sql"),
  "utf8",
);

let database: TestDatabase;
let admin: pg.Client;

beforeAll(async () => {
  database = await createTestDatabase();
  admin = database.admin;
});

afterAll(async () => {
  await database.close();
});

function sqlStateOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return sqlStateOf(error.cause);
  return undefined;
}

async function expectSqlState(promise: Promise<unknown>, sqlState: string) {
  const outcome = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(outcome).toBeInstanceOf(Error);
  expect(sqlStateOf(outcome)).toBe(sqlState);
}

function databaseUrl(source: string, databaseName: string): string {
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function statementsOf(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

describe("orders order_number migration (0029)", () => {
  it("adds order_number nullable, backfills per tenant, then SET NOT NULL", () => {
    expect(orderNumberMigrationSql).toContain(
      `ALTER TABLE "orders" ADD COLUMN "order_number" integer;`,
    );
    expect(orderNumberMigrationSql).toContain("row_number() OVER (");
    expect(orderNumberMigrationSql).toContain('PARTITION BY "company_id"');
    expect(orderNumberMigrationSql).toContain(
      'ORDER BY "created_at" ASC, "id" ASC',
    );
    expect(orderNumberMigrationSql).toContain(
      `ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL`,
    );
    expect(orderNumberMigrationSql).toContain(
      `ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_order_number_uq" UNIQUE("company_id","order_number")`,
    );
    expect(orderNumberMigrationSql).toContain(
      `ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_positive_check"`,
    );
    expect(orderNumberMigrationSql).not.toMatch(
      /ADD COLUMN "order_number" integer NOT NULL/,
    );
  });

  it("leaves migrated order_number NOT NULL with no default", async () => {
    const result = await admin.query<{
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = 'order_number'`,
    );
    expect(result.rows).toEqual([{ is_nullable: "NO", column_default: null }]);
  });

  it("backfills contiguous per-tenant numbers on a non-empty pre-0029 table", async () => {
    const context = inject("dbHarness");
    const name = `ordernum_migrate_${randomUUID().replaceAll("-", "")}`;
    const control = new pg.Client({
      connectionString: databaseUrl(context.adminUrl, "postgres"),
    });
    await control.connect();
    const workspace = await mkdtemp(path.join(tmpdir(), "sho-240-migrate-"));
    let probe: pg.Client | undefined;
    let migrator: ReturnType<typeof createDbClient> | undefined;
    try {
      await control.query(`CREATE DATABASE "${name}"`);
      const priorMigrations = path.join(workspace, "migrations");
      await cp(migrationsFolder, priorMigrations, { recursive: true });
      await rm(path.join(priorMigrations, "0029_uneven_arclight.sql"));
      await rm(path.join(priorMigrations, "meta/0029_snapshot.json"));
      const journalPath = path.join(priorMigrations, "meta/_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
        entries: { idx: number }[];
      };
      journal.entries = journal.entries.filter((entry) => entry.idx < 29);
      await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

      migrator = createDbClient({
        databaseUrl: databaseUrl(context.adminUrl, name),
      });
      await migrate(migrator.db, { migrationsFolder: priorMigrations });
      await migrator.pool.end();
      migrator = undefined;

      probe = new pg.Client({
        connectionString: databaseUrl(context.adminUrl, name),
      });
      await probe.connect();

      const companyA = await probe.query<{ id: string }>(
        `INSERT INTO companies (name, slug, prefix)
         VALUES ('Number Co A', 'number-co-a-${name.slice(-8)}', 'NA')
         RETURNING id`,
      );
      const companyB = await probe.query<{ id: string }>(
        `INSERT INTO companies (name, slug, prefix)
         VALUES ('Number Co B', 'number-co-b-${name.slice(-8)}', 'NB')
         RETURNING id`,
      );
      const companyAId = companyA.rows[0]?.id;
      const companyBId = companyB.rows[0]?.id;
      assert.ok(companyAId);
      assert.ok(companyBId);

      const olderA = randomUUID();
      const newerA = randomUUID();
      const onlyB = randomUUID();
      await probe.query(
        `INSERT INTO orders (
           id, company_id, status, total_net_minor, total_tax_minor,
           total_gross_minor, currency, created_at
         ) VALUES
           ($1, $2, 'new', 100, 0, 100, 'UAH', '2026-01-02T00:00:00.000Z'),
           ($3, $2, 'new', 200, 0, 200, 'UAH', '2026-01-01T00:00:00.000Z'),
           ($4, $5, 'new', 300, 0, 300, 'UAH', '2026-01-03T00:00:00.000Z')`,
        [newerA, companyAId, olderA, onlyB, companyBId],
      );

      await expectSqlState(
        probe.query(
          `ALTER TABLE orders ADD COLUMN "order_number_probe" integer NOT NULL`,
        ),
        "23502",
      );

      for (const statement of statementsOf(orderNumberMigrationSql)) {
        await probe.query(statement);
      }

      const numbered = await probe.query<{
        id: string;
        company_id: string;
        order_number: number;
      }>(
        `SELECT id, company_id, order_number
         FROM orders
         ORDER BY company_id, order_number`,
      );
      const byId = new Map(numbered.rows.map((row) => [row.id, row]));
      expect(byId.get(olderA)?.order_number).toBe(1);
      expect(byId.get(newerA)?.order_number).toBe(2);
      expect(byId.get(onlyB)?.order_number).toBe(1);
      expect(byId.get(olderA)?.company_id).toBe(companyAId);
      expect(byId.get(newerA)?.company_id).toBe(companyAId);
      expect(byId.get(onlyB)?.company_id).toBe(companyBId);
    } finally {
      if (probe !== undefined) {
        await probe.end();
      }
      if (migrator !== undefined) {
        await migrator.pool.end();
      }
      await control.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await control.end();
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
