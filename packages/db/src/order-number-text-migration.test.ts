/**
 * SHO-250: 0032 rewrites integer `order_number` to `{prefix}-{token}`
 * and adds `order_number_counters`. Empty-DB apply is the harness
 * template (all migrations). This file proves the SQL backfill on a DB
 * that already has post-0029 integer rows (0032 excluded).
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
const orderNumberTextMigrationSql = readFileSync(
  path.join(migrationsFolder, "0032_easy_smiling_tiger.sql"),
  "utf8",
);

/** v1 obfuscate_seq(1) / obfuscate_seq(2). */
const TOKEN_1 = "17Z992";
const TOKEN_2 = "2FY8Z7";

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

describe("orders text order_number migration (0032)", () => {
  it("rewrites integers via companies.prefix + v1 obfuscate, then CHECK", () => {
    expect(orderNumberTextMigrationSql).toContain(
      `CREATE TABLE "order_number_counters"`,
    );
    expect(orderNumberTextMigrationSql).toContain(
      `INSERT INTO "order_number_counters"`,
    );
    expect(orderNumberTextMigrationSql).toContain('MAX("order_number")');
    expect(orderNumberTextMigrationSql).toContain(
      `ALTER TABLE "orders" DROP CONSTRAINT "orders_order_number_positive_check"`,
    );
    expect(orderNumberTextMigrationSql).toContain(
      "showzy_sho250_obfuscate_seq",
    );
    expect(orderNumberTextMigrationSql).toContain(
      `ALTER TABLE "orders" ALTER COLUMN "order_number" SET DATA TYPE text USING ("order_number"::text)`,
    );
    expect(orderNumberTextMigrationSql).toContain(`UPDATE "orders" AS o`);
    expect(orderNumberTextMigrationSql).toContain(`FROM "companies" AS c`);
    expect(orderNumberTextMigrationSql).toContain(
      `WHERE c."id" = o."company_id"`,
    );
    expect(orderNumberTextMigrationSql).toContain(
      `ADD CONSTRAINT "orders_order_number_shape_check" CHECK ("orders"."order_number" ~ '^[A-Z0-9]+-[0-9A-Z]+$')`,
    );
    expect(orderNumberTextMigrationSql).toContain(
      "Foundation SQL exception (SHO-250",
    );
    expect(orderNumberTextMigrationSql).toContain(
      "DROP FUNCTION showzy_sho250_obfuscate_seq(bigint)",
    );
  });

  it("leaves migrated order_number text NOT NULL with no default", async () => {
    const result = await admin.query<{
      is_nullable: string;
      column_default: string | null;
      data_type: string;
    }>(
      `SELECT is_nullable, column_default, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = 'order_number'`,
    );
    expect(result.rows).toEqual([
      { is_nullable: "NO", column_default: null, data_type: "text" },
    ]);
  });

  it("backfills {prefix}-{token} and seeds counters on a non-empty integer table", async () => {
    const context = inject("dbHarness");
    const name = `ordernum_text_${randomUUID().replaceAll("-", "")}`;
    const control = new pg.Client({
      connectionString: databaseUrl(context.adminUrl, "postgres"),
    });
    await control.connect();
    const workspace = await mkdtemp(path.join(tmpdir(), "sho-250-migrate-"));
    let probe: pg.Client | undefined;
    let migrator: ReturnType<typeof createDbClient> | undefined;
    try {
      await control.query(`CREATE DATABASE "${name}"`);
      const priorMigrations = path.join(workspace, "migrations");
      await cp(migrationsFolder, priorMigrations, { recursive: true });
      await rm(path.join(priorMigrations, "0032_easy_smiling_tiger.sql"));
      await rm(path.join(priorMigrations, "meta/0032_snapshot.json"));
      const journalPath = path.join(priorMigrations, "meta/_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
        entries: { idx: number }[];
      };
      journal.entries = journal.entries.filter((entry) => entry.idx < 32);
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
         VALUES ('Number Co A', 'number-text-a-${name.slice(-8)}', 'NA')
         RETURNING id`,
      );
      const companyB = await probe.query<{ id: string }>(
        `INSERT INTO companies (name, slug, prefix)
         VALUES ('Number Co B', 'number-text-b-${name.slice(-8)}', 'NB')
         RETURNING id`,
      );
      const companyAId = companyA.rows[0]?.id;
      const companyBId = companyB.rows[0]?.id;
      assert.ok(companyAId);
      assert.ok(companyBId);

      const firstA = randomUUID();
      const secondA = randomUUID();
      const onlyB = randomUUID();
      await probe.query(
        `INSERT INTO orders (
           id, company_id, order_number, status, total_net_minor, total_tax_minor,
           total_gross_minor, currency
         ) VALUES
           ($1, $2, 1, 'new', 100, 0, 100, 'UAH'),
           ($3, $2, 2, 'new', 200, 0, 200, 'UAH'),
           ($4, $5, 1, 'new', 300, 0, 300, 'UAH')`,
        [firstA, companyAId, secondA, onlyB, companyBId],
      );

      for (const statement of statementsOf(orderNumberTextMigrationSql)) {
        await probe.query(statement);
      }

      const numbered = await probe.query<{
        id: string;
        company_id: string;
        order_number: string;
      }>(
        `SELECT id, company_id, order_number
         FROM orders
         ORDER BY company_id, order_number`,
      );
      const byId = new Map(numbered.rows.map((row) => [row.id, row]));
      expect(byId.get(firstA)?.order_number).toBe(`NA-${TOKEN_1}`);
      expect(byId.get(secondA)?.order_number).toBe(`NA-${TOKEN_2}`);
      expect(byId.get(onlyB)?.order_number).toBe(`NB-${TOKEN_1}`);
      expect(byId.get(firstA)?.order_number).not.toBe("1");
      expect(numbered.rows.map((row) => row.order_number)).not.toContain("1");

      const counters = await probe.query<{
        company_id: string;
        last_number: string;
      }>(
        `SELECT company_id, last_number::text
         FROM order_number_counters
         ORDER BY company_id`,
      );
      const lastByCompany = new Map(
        counters.rows.map((row) => [row.company_id, row.last_number]),
      );
      expect(lastByCompany.get(companyAId)).toBe("2");
      expect(lastByCompany.get(companyBId)).toBe("1");

      await expectSqlState(
        probe.query(
          `INSERT INTO orders (
             company_id, order_number, status, total_net_minor, total_tax_minor,
             total_gross_minor, currency
           ) VALUES ($1, '1', 'new', 1, 0, 1, 'UAH')`,
          [companyAId],
        ),
        "23514",
      );
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
