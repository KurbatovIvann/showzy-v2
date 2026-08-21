/**
 * SHO-96: 0012 must add catalog `name` onto tables that 0008 created
 * without it. Data-path assertions use the admin client for PostgreSQL
 * catalog checks; the probe table is not a domain table.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

const catalogNameMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../migrations/0012_careless_franklin_richards.sql",
  ),
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

describe("catalog name migration (0012)", () => {
  it("adds name with a temporary default that is then dropped", () => {
    expect(catalogNameMigrationSql).toContain(
      `ALTER TABLE "product_variants" ADD COLUMN "name" text DEFAULT '' NOT NULL`,
    );
    expect(catalogNameMigrationSql).toContain(
      `ALTER TABLE "product_variants" ALTER COLUMN "name" DROP DEFAULT`,
    );
    expect(catalogNameMigrationSql).toContain(
      `ALTER TABLE "products" ADD COLUMN "name" text DEFAULT '' NOT NULL`,
    );
    expect(catalogNameMigrationSql).toContain(
      `ALTER TABLE "products" ALTER COLUMN "name" DROP DEFAULT`,
    );
    expect(catalogNameMigrationSql).not.toMatch(
      /ADD COLUMN "name" text NOT NULL;/,
    );
  });

  it("succeeds on a non-empty 0008-shaped table; the no-default form fails", async () => {
    await admin.query(`
      CREATE TABLE catalog_name_migrate_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
      )
    `);
    try {
      await admin.query(
        `INSERT INTO catalog_name_migrate_probe DEFAULT VALUES`,
      );
      await expectSqlState(
        admin.query(
          `ALTER TABLE catalog_name_migrate_probe ADD COLUMN "name" text NOT NULL`,
        ),
        "23502",
      );
      await admin.query(
        `ALTER TABLE catalog_name_migrate_probe ADD COLUMN "name" text DEFAULT '' NOT NULL`,
      );
      await admin.query(
        `ALTER TABLE catalog_name_migrate_probe ALTER COLUMN "name" DROP DEFAULT`,
      );
      const rows = await admin.query<{ name: string }>(
        `SELECT name FROM catalog_name_migrate_probe`,
      );
      expect(rows.rows).toEqual([{ name: "" }]);
      const column = await admin.query<{
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'catalog_name_migrate_probe'
           AND column_name = 'name'`,
      );
      expect(column.rows).toEqual([
        { is_nullable: "NO", column_default: null },
      ]);
    } finally {
      await admin.query(`DROP TABLE IF EXISTS catalog_name_migrate_probe`);
    }
  });

  it("leaves migrated catalog name columns NOT NULL with no default", async () => {
    const result = await admin.query<{
      table_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT table_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('products', 'product_variants')
         AND column_name = 'name'
       ORDER BY table_name`,
    );
    expect(result.rows).toEqual([
      {
        table_name: "product_variants",
        is_nullable: "NO",
        column_default: null,
      },
      {
        table_name: "products",
        is_nullable: "NO",
        column_default: null,
      },
    ]);
  });
});
