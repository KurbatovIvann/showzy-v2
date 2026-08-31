/**
 * SHO-223: 0027 must create `company_legal_info` without backfilling rows.
 * Empty-DB apply is the harness template (all migrations). This file proves
 * the SQL has no INSERT and a DB that already has foundation `companies`
 * rows keeps those companies without a legal row.
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
const legalMigrationSql = readFileSync(
  path.join(migrationsFolder, "0027_parallel_abomination.sql"),
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

describe("company_legal_info migration (0027)", () => {
  it("creates the table and trigger without backfilling legal rows", () => {
    expect(legalMigrationSql).toContain('CREATE TABLE "company_legal_info"');
    expect(legalMigrationSql).toContain(
      'CONSTRAINT "company_legal_info_company_id_uq" UNIQUE("company_id")',
    );
    expect(legalMigrationSql).toContain(
      'CONSTRAINT "company_legal_info_company_id_id_uq" UNIQUE("company_id","id")',
    );
    expect(legalMigrationSql).toContain("company_legal_info_set_updated_at");
    expect(legalMigrationSql).not.toMatch(
      /INSERT INTO ["']?company_legal_info/i,
    );
  });

  it("leaves existing companies without a legal row on the template DB", async () => {
    const company = await admin.query<{ id: string }>(
      `INSERT INTO companies (name, slug, prefix)
       VALUES ('Template Co', 'template-legal-${database.name.slice(-8)}', 'T${database.name.slice(-4).toUpperCase()}')
       RETURNING id`,
    );
    const companyId = company.rows[0]?.id;
    assert.ok(companyId);
    const legal = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM company_legal_info WHERE company_id = $1`,
      [companyId],
    );
    expect(legal.rows[0]?.count).toBe("0");
  });

  it("applies on a DB that already has foundation companies rows", async () => {
    const context = inject("dbHarness");
    const name = `legal_migrate_${randomUUID().replaceAll("-", "")}`;
    const control = new pg.Client({
      connectionString: databaseUrl(context.adminUrl, "postgres"),
    });
    await control.connect();
    const workspace = await mkdtemp(path.join(tmpdir(), "sho-223-migrate-"));
    let probe: pg.Client | undefined;
    let migrator: ReturnType<typeof createDbClient> | undefined;
    try {
      await control.query(`CREATE DATABASE "${name}"`);
      const priorMigrations = path.join(workspace, "migrations");
      await cp(migrationsFolder, priorMigrations, { recursive: true });
      await rm(path.join(priorMigrations, "0027_parallel_abomination.sql"));
      await rm(path.join(priorMigrations, "meta/0027_snapshot.json"));
      const journalPath = path.join(priorMigrations, "meta/_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
        entries: { idx: number }[];
      };
      journal.entries = journal.entries.filter((entry) => entry.idx < 27);
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
         VALUES ('Migrate Co', 'migrate-legal-${name.slice(-8)}', 'M${name.slice(-4).toUpperCase()}')
         RETURNING id`,
      );
      const companyId = company.rows[0]?.id;
      assert.ok(companyId);

      const missing = await probe.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'company_legal_info'`,
      );
      expect(missing.rows).toEqual([]);

      for (const statement of statementsOf(legalMigrationSql)) {
        await probe.query(statement);
      }

      const tables = await probe.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'company_legal_info'`,
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        "company_legal_info",
      ]);

      const legal = await probe.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM company_legal_info WHERE company_id = $1`,
        [companyId],
      );
      expect(legal.rows[0]?.count).toBe("0");

      const inserted = await probe.query<{ company_type: string }>(
        `INSERT INTO company_legal_info (company_id) VALUES ($1) RETURNING company_type`,
        [companyId],
      );
      expect(inserted.rows).toEqual([{ company_type: "fop" }]);
    } finally {
      if (probe !== undefined) await probe.end();
      if (migrator !== undefined) await migrator.pool.end();
      await rm(workspace, { recursive: true, force: true });
      await control.query(`DROP DATABASE IF EXISTS "${name}"`);
      await control.end();
    }
  });
});
