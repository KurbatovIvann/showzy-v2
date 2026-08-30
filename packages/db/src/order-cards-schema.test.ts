/**
 * SHO-93 (chat-T1) verification for the order-card projection schema.
 * Data-path assertions use Drizzle through the runtime role; raw SQL is
 * limited to PostgreSQL catalog structure checks.
 */
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import pg from "pg";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";

import { rolePermissionDefaultRows } from "../seed/role-permission-defaults.js";
import type { DbClient } from "./client.js";
import { orderCards } from "./schema/chat.js";
import { companies } from "./schema/companies.js";
import { orders } from "./schema/orders.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

let database: TestDatabase;
let dbClient: DbClient;
let admin: pg.Client;
let sequence = 0;
const nextOrderNumberByCompany = new Map<string, number>();

beforeAll(async () => {
  database = await createTestDatabase();
  dbClient = database.runtime;
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

async function insertCompany() {
  sequence += 1;
  const rows = await dbClient.db
    .insert(companies)
    .values({
      name: `Chat Co ${String(sequence)}`,
      slug: `chat-co-${String(sequence)}`,
      prefix: `C${String(sequence)}`,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertOrder(
  values: Omit<
    typeof orders.$inferInsert,
    "totalNetMinor" | "totalTaxMinor" | "totalGrossMinor" | "orderNumber"
  > & {
    totalNetMinor?: bigint;
    totalTaxMinor?: bigint;
    totalGrossMinor?: bigint;
    orderNumber?: string;
  },
) {
  const next = (nextOrderNumberByCompany.get(values.companyId) ?? 0) + 1;
  nextOrderNumberByCompany.set(values.companyId, next);
  const rows = await dbClient.db
    .insert(orders)
    .values({
      totalNetMinor: 10_000n,
      totalTaxMinor: 0n,
      totalGrossMinor: 10_000n,
      orderNumber: `T-${String(next)}`,
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertCard(values: typeof orderCards.$inferInsert) {
  const rows = await dbClient.db.insert(orderCards).values(values).returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

describe("order cards schema slice", () => {
  it("creates only the card-named columns with timestamptz timestamps", async () => {
    const result = await admin.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'order_cards'
       ORDER BY ordinal_position`,
    );
    const names = result.rows.map((row) => row.column_name);
    expect(names).toEqual([
      "id",
      "company_id",
      "order_id",
      "revision",
      "created_at",
      "updated_at",
    ]);
    for (const row of result.rows) {
      if (row.column_name.endsWith("_at")) {
        expect(row.data_type).toBe("timestamp with time zone");
      }
    }
    for (const forbidden of [
      "status",
      "total_net_minor",
      "total_tax_minor",
      "total_gross_minor",
      "currency",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("does not create conversation-platform tables", async () => {
    const result = await admin.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN
           ('conversations', 'messages', 'participants', 'reactions',
            'conversation_reads', 'realtime_channels')`,
    );
    expect(result.rows).toEqual([]);
  });

  it("represents revision as an integer in TypeScript", () => {
    expectTypeOf<
      (typeof orderCards.$inferSelect)["revision"]
    >().toEqualTypeOf<number>();
  });

  it("declares UNIQUE (company_id, id), unique (order_id), and the tenant DESC index", async () => {
    const result = await admin.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'order_cards'`,
    );
    const indexes = new Map(
      result.rows.map((row) => [row.indexname, row.indexdef]),
    );

    expect(indexes.get("order_cards_company_id_id_uq")).toContain("UNIQUE");
    expect(indexes.get("order_cards_company_id_id_uq")).toContain(
      "(company_id, id)",
    );
    expect(indexes.get("order_cards_order_id_uq")).toContain("UNIQUE");
    expect(indexes.get("order_cards_order_id_uq")).toContain("(order_id)");

    const updatedAt = indexes.get("order_cards_company_updated_at_idx");
    expect(updatedAt).toContain("(company_id");
    expect(updatedAt).toMatch(/updated_at.*DESC/i);
  });

  it("declares the composite same-tenant order foreign key (ADR-0025)", async () => {
    const result = await admin.query<{
      conname: string;
      definition: string;
    }>(
      `SELECT con.conname,
              pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE nsp.nspname = 'public'
         AND con.contype = 'f'
         AND rel.relname = 'order_cards'
       ORDER BY con.conname`,
    );
    const defs = new Map(
      result.rows.map((row) => [row.conname, row.definition]),
    );

    expect(defs.get("order_cards_orders_company_fk")).toContain(
      "(company_id, order_id) REFERENCES orders(company_id, id)",
    );
    expect(defs.get("order_cards_orders_company_fk")).toContain(
      "ON DELETE CASCADE",
    );
  });

  it("defaults revision to 1 and rejects a second card for the same order", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const card = await insertCard({
      companyId: company.id,
      orderId: order.id,
    });
    expect(card.revision).toBe(1);

    await expectSqlState(
      insertCard({ companyId: company.id, orderId: order.id }),
      "23505",
    );
  });

  it("rejects a card that points at another tenant's order", async () => {
    const companyA = await insertCompany();
    const companyB = await insertCompany();
    const orderB = await insertOrder({ companyId: companyB.id });

    await expectSqlState(
      insertCard({ companyId: companyA.id, orderId: orderB.id }),
      "23503",
    );
  });

  it("cascades order deletion to the card", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    await insertCard({ companyId: company.id, orderId: order.id });

    await dbClient.db.delete(orders).where(eq(orders.id, order.id));
    expect(
      await dbClient.db
        .select()
        .from(orderCards)
        .where(eq(orderCards.orderId, order.id)),
    ).toEqual([]);
  });

  it("attaches the shared updated_at trigger to order_cards", async () => {
    const result = await admin.query<{ tgname: string }>(
      `SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND t.tgname LIKE '%_set_updated_at'
         AND c.relname = 'order_cards'`,
    );
    expect(result.rows.map((row) => row.tgname)).toEqual([
      "order_cards_set_updated_at",
    ]);

    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const card = await insertCard({
      companyId: company.id,
      orderId: order.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await dbClient.db
      .update(orderCards)
      .set({ revision: 2 })
      .where(eq(orderCards.id, card.id))
      .returning();
    expect(updated[0]?.updatedAt.getTime()).toBeGreaterThan(
      card.updatedAt.getTime(),
    );
  });

  it("seeds chat:view for admin, manager, and employee", () => {
    const keys = new Set(
      rolePermissionDefaultRows.map((row) => `${row.role}:${row.permission}`),
    );
    for (const role of ["admin", "manager", "employee"] as const) {
      expect(keys.has(`${role}:chat:view`)).toBe(true);
    }
    expect(keys.has("owner:chat:view")).toBe(false);
  });
});
