/**
 * SHO-283 (db-T2): pagination-covering indexes match shipped list
 * `orderBy` shapes. Planner assertions use EXPLAIN (catalog structure);
 * tables are seeded then seq/bitmap/sort are session-local disabled so
 * the paginated path must walk the DESC index in order.
 */
import assert from "node:assert/strict";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DbClient } from "./client.js";
import { user } from "./schema/auth.js";
import { products } from "./schema/catalog.js";
import { companies } from "./schema/companies.js";
import { companyCustomers, counterparties } from "./schema/customers.js";
import { documents } from "./schema/documents.js";
import { companyCustomerInvites } from "./schema/invites.js";
import { orders } from "./schema/orders.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

const PAGE_LIMIT = 21;
const SEED_ROWS = 80;
const supplierDetails = { legalName: "Fixture supplier" };
const buyerDetails = { kind: "customer", displayName: "Fixture buyer" };

let database: TestDatabase;
let dbClient: DbClient;
let admin: pg.Client;
let companyId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  dbClient = database.runtime;
  admin = database.admin;
  companyId = await seedListTables();
  await admin.query(
    `ANALYZE company_customers, counterparties, company_customer_invites,
            products, orders, documents`,
  );
});

afterAll(async () => {
  await database.close();
});

async function seedListTables(): Promise<string> {
  const companiesInserted = await dbClient.db
    .insert(companies)
    .values({
      name: "List index co",
      slug: "list-index-co",
      prefix: "LI",
    })
    .returning();
  const company = companiesInserted[0];
  assert.ok(company);

  const inviterId = "list_idx_user_1";
  await dbClient.db.insert(user).values({
    id: inviterId,
    name: "List index user",
    email: "list-index-user@example.com",
  });

  await dbClient.db.insert(products).values(
    Array.from({ length: SEED_ROWS }, (_, index) => ({
      companyId: company.id,
      name: `Product ${String(index)}`,
      basePriceMinor: 10_000n,
    })),
  );

  await dbClient.db.insert(companyCustomers).values(
    Array.from({ length: SEED_ROWS }, (_, index) => ({
      companyId: company.id,
      name: `Customer ${String(index)}`,
      email: `list-customer-${String(index)}@example.com`,
    })),
  );

  await dbClient.db.insert(counterparties).values(
    Array.from({ length: SEED_ROWS }, (_, index) => ({
      companyId: company.id,
      name: `Counterparty ${String(index)}`,
    })),
  );

  await dbClient.db.insert(companyCustomerInvites).values(
    Array.from({ length: SEED_ROWS }, (_, index) => ({
      companyId: company.id,
      invitedBy: inviterId,
      tokenHash: (index + 1).toString(16).padStart(64, "b"),
      isReusable: false,
      maxUses: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })),
  );

  const orderRows = await dbClient.db
    .insert(orders)
    .values(
      Array.from({ length: SEED_ROWS }, (_, index) => ({
        companyId: company.id,
        orderNumber: `LI-${index.toString(36).toUpperCase()}`,
        totalNetMinor: 10_000n,
        totalTaxMinor: 0n,
        totalGrossMinor: 10_000n,
      })),
    )
    .returning({ id: orders.id });

  await dbClient.db.insert(documents).values(
    orderRows.map((order, index) => ({
      companyId: company.id,
      orderId: order.id,
      type: "payment_invoice",
      documentNumber: `INV-${String(index)}`,
      issuedOn: "2026-08-29",
      supplierDetails,
      buyerDetails,
      totalNetMinor: 10_000n,
      totalTaxMinor: 0n,
      totalGrossMinor: 10_000n,
      templateName: "Payment invoice",
    })),
  );

  return company.id;
}

async function explain(
  sql: string,
  params: readonly string[],
): Promise<string> {
  await admin.query("BEGIN");
  try {
    await admin.query("SET LOCAL enable_seqscan = off");
    await admin.query("SET LOCAL enable_bitmapscan = off");
    await admin.query("SET LOCAL enable_sort = off");
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
  expect(plan).not.toMatch(/\bSort\b/);
}

describe("list access indexes (SHO-283)", () => {
  it("uses pagination indexes for shipped list orderBy shapes", async () => {
    const customers = await explain(
      `EXPLAIN SELECT id FROM company_customers
       WHERE company_id = $1 AND status = 'active'
       ORDER BY updated_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      customers,
      "company_customers_company_updated_at_id_idx",
    );

    const counterpartiesPlan = await explain(
      `EXPLAIN SELECT id FROM counterparties
       WHERE company_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      counterpartiesPlan,
      "counterparties_company_updated_at_id_idx",
    );

    const invites = await explain(
      `EXPLAIN SELECT id FROM company_customer_invites
       WHERE company_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      invites,
      "company_customer_invites_company_updated_at_id_idx",
    );

    const productsPlan = await explain(
      `EXPLAIN SELECT id FROM products
       WHERE company_id = $1 AND status = 'active'
       ORDER BY created_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      productsPlan,
      "products_company_created_at_id_idx",
    );

    const ordersPlan = await explain(
      `EXPLAIN SELECT id FROM orders
       WHERE company_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(ordersPlan, "orders_company_created_at_idx");

    const documentsPlan = await explain(
      `EXPLAIN SELECT id FROM documents
       WHERE company_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT ${String(PAGE_LIMIT)}`,
      [companyId],
    );
    expectIndexOnlyPaginatedPath(
      documentsPlan,
      "documents_company_created_at_idx",
    );
  });
});
