/**
 * SHO-283 (db-T2): pagination-covering indexes match shipped list
 * `orderBy` shapes. Planner assertions use EXPLAIN (catalog structure);
 * `enable_seqscan` is session-local so empty tables still pick an index.
 */
import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

let database: TestDatabase;
let admin: pg.Client;

beforeAll(async () => {
  database = await createTestDatabase();
  admin = database.admin;
});

afterAll(async () => {
  await database.close();
});

async function explain(
  sql: string,
  params: readonly string[],
): Promise<string> {
  await admin.query("BEGIN");
  try {
    await admin.query("SET LOCAL enable_seqscan = off");
    const result = await admin.query<{ "QUERY PLAN": string }>(sql, [
      ...params,
    ]);
    return result.rows.map((row) => row["QUERY PLAN"]).join("\n");
  } finally {
    await admin.query("ROLLBACK");
  }
}

function expectIndexOnlyPaginatedPath(plan: string, indexName: string): void {
  expect(plan).toContain(indexName);
  expect(plan).not.toMatch(/\bSeq Scan\b/);
}

describe("list access indexes (SHO-283)", () => {
  const companyId = randomUUID();

  it("uses pagination indexes for shipped list orderBy shapes", async () => {
    const customers = await explain(
      `EXPLAIN SELECT id FROM company_customers
       WHERE company_id = $1 AND status = 'active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      customers,
      "company_customers_company_updated_at_id_idx",
    );

    const counterparties = await explain(
      `EXPLAIN SELECT id FROM counterparties
       WHERE company_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      counterparties,
      "counterparties_company_updated_at_id_idx",
    );

    const invites = await explain(
      `EXPLAIN SELECT id FROM company_customer_invites
       WHERE company_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      invites,
      "company_customer_invites_company_updated_at_id_idx",
    );

    const products = await explain(
      `EXPLAIN SELECT id FROM products
       WHERE company_id = $1 AND status = 'active'
       ORDER BY created_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      products,
      "products_company_created_at_id_idx",
    );

    const orders = await explain(
      `EXPLAIN SELECT id FROM orders
       WHERE company_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(orders, "orders_company_created_at_idx");

    const documents = await explain(
      `EXPLAIN SELECT id FROM documents
       WHERE company_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 21`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(documents, "documents_company_created_at_idx");
  });
});
