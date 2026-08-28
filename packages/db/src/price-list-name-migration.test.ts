/**
 * SHO-171: 0024 must add `price_lists.name` onto the table that 0008
 * created without it, and backfill Default / Price list. Data-path
 * assertions use the admin client for PostgreSQL catalog checks; the
 * probe table is not a domain table.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

const priceListNameMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../migrations/0024_amused_weapon_omega.sql",
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

describe("price list name migration (0024)", () => {
  it("adds name with a temporary default, backfill, then drops the default", () => {
    expect(priceListNameMigrationSql).toContain(
      `ALTER TABLE "price_lists" ADD COLUMN "name" text DEFAULT 'Price list' NOT NULL`,
    );
    expect(priceListNameMigrationSql).toContain(
      `UPDATE "price_lists" SET "name" = 'Default' WHERE "is_default" = true`,
    );
    expect(priceListNameMigrationSql).toContain(
      `ALTER TABLE "price_lists" ALTER COLUMN "name" DROP DEFAULT`,
    );
    expect(priceListNameMigrationSql).toContain(
      `ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_name_length_check" CHECK (char_length("price_lists"."name") BETWEEN 1 AND 120)`,
    );
    expect(priceListNameMigrationSql).not.toMatch(
      /ADD COLUMN "name" text NOT NULL;/,
    );
  });

  it("succeeds on a non-empty 0008-shaped table; the no-default form fails", async () => {
    await admin.query(`
      CREATE TABLE price_list_name_migrate_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        is_default boolean DEFAULT false NOT NULL
      )
    `);
    try {
      await admin.query(
        `INSERT INTO price_list_name_migrate_probe (is_default) VALUES (false), (true)`,
      );
      await expectSqlState(
        admin.query(
          `ALTER TABLE price_list_name_migrate_probe ADD COLUMN "name" text NOT NULL`,
        ),
        "23502",
      );
      await admin.query(
        `ALTER TABLE price_list_name_migrate_probe ADD COLUMN "name" text DEFAULT 'Price list' NOT NULL`,
      );
      await admin.query(
        `UPDATE price_list_name_migrate_probe SET "name" = 'Default' WHERE "is_default" = true`,
      );
      await admin.query(
        `ALTER TABLE price_list_name_migrate_probe ALTER COLUMN "name" DROP DEFAULT`,
      );
      await admin.query(
        `ALTER TABLE price_list_name_migrate_probe ADD CONSTRAINT price_list_name_migrate_probe_name_length_check CHECK (char_length("name") BETWEEN 1 AND 120)`,
      );
      const rows = await admin.query<{ name: string; is_default: boolean }>(
        `SELECT name, is_default FROM price_list_name_migrate_probe ORDER BY is_default`,
      );
      expect(rows.rows).toEqual([
        { name: "Price list", is_default: false },
        { name: "Default", is_default: true },
      ]);
      const column = await admin.query<{
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'price_list_name_migrate_probe'
           AND column_name = 'name'`,
      );
      expect(column.rows).toEqual([
        { is_nullable: "NO", column_default: null },
      ]);
      await expectSqlState(
        admin.query(
          `INSERT INTO price_list_name_migrate_probe (name) VALUES ($1)`,
          [""],
        ),
        "23514",
      );
      await expectSqlState(
        admin.query(
          `INSERT INTO price_list_name_migrate_probe (name) VALUES ($1)`,
          ["x".repeat(121)],
        ),
        "23514",
      );
    } finally {
      await admin.query(`DROP TABLE IF EXISTS price_list_name_migrate_probe`);
    }
  });

  it("leaves migrated price_lists name NOT NULL with no default", async () => {
    const result = await admin.query<{
      table_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT table_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'price_lists'
         AND column_name = 'name'`,
    );
    expect(result.rows).toEqual([
      {
        table_name: "price_lists",
        is_nullable: "NO",
        column_default: null,
      },
    ]);
  });
});
