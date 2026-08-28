/**
 * SHO-170: 0024 must widen assignment-only CRM tables from 0008 without
 * failing on existing rows. Empty-DB apply is the harness template
 * (all migrations). This file proves the SQL backfill and a DB that
 * already has pricing-slice customer/group rows.
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
const crmMigrationSql = readFileSync(
  path.join(migrationsFolder, "0024_wakeful_adam_destine.sql"),
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

describe("customers CRM migration (0024)", () => {
  it("backfills name/slug/contact instead of adding NOT NULL with no default", () => {
    expect(crmMigrationSql).toContain(
      `ALTER TABLE "company_customers" ADD COLUMN "name" text;`,
    );
    expect(crmMigrationSql).toContain(
      `ALTER TABLE "customer_groups" ADD COLUMN "name" text;`,
    );
    expect(crmMigrationSql).toContain(
      `ALTER TABLE "customer_groups" ADD COLUMN "slug" text;`,
    );
    expect(crmMigrationSql).toContain(
      `'Group ' || replace("id"::text, '-', '')`,
    );
    expect(crmMigrationSql).toContain(
      `'group-' || replace("id"::text, '-', '')`,
    );
    expect(crmMigrationSql).toContain(
      `'Customer ' || replace("id"::text, '-', '')`,
    );
    expect(crmMigrationSql).toContain("'@invalid.local'");
    expect(crmMigrationSql).toContain(
      `ALTER TABLE "company_customers" ALTER COLUMN "name" SET NOT NULL`,
    );
    expect(crmMigrationSql).toContain(
      `ALTER TABLE "customer_groups" ALTER COLUMN "slug" SET NOT NULL`,
    );
    expect(crmMigrationSql).toContain(`ON DELETE SET NULL ("customer_id")`);
    expect(crmMigrationSql).toContain(
      "company_customers_preserve_contact_on_user_delete",
    );
    expect(crmMigrationSql).not.toMatch(/ADD COLUMN "name" text NOT NULL/);
    expect(crmMigrationSql).not.toMatch(/ADD COLUMN "slug" text NOT NULL/);
  });

  it("leaves migrated CRM name columns NOT NULL with no default", async () => {
    const result = await admin.query<{
      table_name: string;
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT table_name, column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'customer_groups' AND column_name IN ('name', 'slug'))
           OR (table_name = 'company_customers' AND column_name = 'name')
         )
       ORDER BY table_name, column_name`,
    );
    expect(result.rows).toEqual([
      {
        table_name: "company_customers",
        column_name: "name",
        is_nullable: "NO",
        column_default: null,
      },
      {
        table_name: "customer_groups",
        column_name: "name",
        is_nullable: "NO",
        column_default: null,
      },
      {
        table_name: "customer_groups",
        column_name: "slug",
        is_nullable: "NO",
        column_default: null,
      },
    ]);
  });

  it("applies on a DB that already has assignment-only customer/group rows", async () => {
    const context = inject("dbHarness");
    const name = `crm_migrate_${randomUUID().replaceAll("-", "")}`;
    const control = new pg.Client({
      connectionString: databaseUrl(context.adminUrl, "postgres"),
    });
    await control.connect();
    const workspace = await mkdtemp(path.join(tmpdir(), "sho-170-migrate-"));
    let probe: pg.Client | undefined;
    let migrator: ReturnType<typeof createDbClient> | undefined;
    try {
      await control.query(`CREATE DATABASE "${name}"`);
      const priorMigrations = path.join(workspace, "migrations");
      await cp(migrationsFolder, priorMigrations, { recursive: true });
      await rm(path.join(priorMigrations, "0024_wakeful_adam_destine.sql"));
      await rm(path.join(priorMigrations, "meta/0024_snapshot.json"));
      const journalPath = path.join(priorMigrations, "meta/_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
        entries: { idx: number }[];
      };
      journal.entries = journal.entries.filter((entry) => entry.idx < 24);
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

      const company = await probe.query<{ id: string }>(
        `INSERT INTO companies (name, slug, prefix)
         VALUES ('Migrate Co', 'migrate-co-${name.slice(-8)}', 'M${name.slice(-4)}')
         RETURNING id`,
      );
      const companyId = company.rows[0]?.id;
      assert.ok(companyId);
      const group = await probe.query<{ id: string }>(
        `INSERT INTO customer_groups (company_id)
         VALUES ($1)
         RETURNING id`,
        [companyId],
      );
      const customer = await probe.query<{ id: string }>(
        `INSERT INTO company_customers (company_id)
         VALUES ($1)
         RETURNING id`,
        [companyId],
      );
      const groupId = group.rows[0]?.id;
      const customerId = customer.rows[0]?.id;
      assert.ok(groupId);
      assert.ok(customerId);

      await expectSqlState(
        probe.query(
          `ALTER TABLE company_customers ADD COLUMN "name_probe" text NOT NULL`,
        ),
        "23502",
      );

      for (const statement of statementsOf(crmMigrationSql)) {
        await probe.query(statement);
      }

      const groupRow = await probe.query<{
        name: string;
        slug: string;
        sort_order: number;
      }>(`SELECT name, slug, sort_order FROM customer_groups WHERE id = $1`, [
        groupId,
      ]);
      const compactGroupId = groupId.replaceAll("-", "");
      expect(groupRow.rows).toEqual([
        {
          name: `Group ${compactGroupId}`,
          slug: `group-${compactGroupId}`,
          sort_order: 0,
        },
      ]);

      const customerRow = await probe.query<{
        name: string;
        email: string | null;
        status: string;
      }>(`SELECT name, email, status FROM company_customers WHERE id = $1`, [
        customerId,
      ]);
      expect(customerRow.rows).toEqual([
        {
          name: `Customer ${customerId.replaceAll("-", "")}`,
          email: `legacy.${customerId}@invalid.local`,
          status: "active",
        },
      ]);

      const tables = await probe.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('counterparties', 'customer_legal_profiles')
         ORDER BY table_name`,
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        "counterparties",
        "customer_legal_profiles",
      ]);
    } finally {
      if (probe !== undefined) await probe.end();
      if (migrator !== undefined) await migrator.pool.end();
      await rm(workspace, { recursive: true, force: true });
      await control.query(`DROP DATABASE IF EXISTS "${name}"`);
      await control.end();
    }
  });
});
