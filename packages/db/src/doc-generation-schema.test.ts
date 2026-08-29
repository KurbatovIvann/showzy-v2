/**
 * SHO-232 (doc-generation-T1) verification for `document_generation_jobs`.
 * Data-path assertions use Drizzle through the runtime role; raw SQL is
 * limited to PostgreSQL catalog structure checks.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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

import type { DbClient } from "./client.js";
import { companies } from "./schema/companies.js";
import { documentGenerationJobs } from "./schema/doc-generation.js";
import { documents } from "./schema/documents.js";
import { files } from "./schema/files.js";
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

const supplierDetails = { legalName: "ФОП Fixture", edrpou: "12345678" };
const buyerDetails = { kind: "customer", displayName: "Fixture buyer" };

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
      name: `Gen Co ${String(sequence)}`,
      slug: `gen-co-${String(sequence)}`,
      prefix: `G${String(sequence)}`,
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
    orderNumber?: number;
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
      orderNumber: next,
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertDocument(
  values: Omit<
    typeof documents.$inferInsert,
    | "type"
    | "documentNumber"
    | "issuedOn"
    | "supplierDetails"
    | "buyerDetails"
    | "totalNetMinor"
    | "totalTaxMinor"
    | "totalGrossMinor"
    | "templateName"
  > &
    Partial<typeof documents.$inferInsert>,
) {
  sequence += 1;
  const rows = await dbClient.db
    .insert(documents)
    .values({
      type: "payment_invoice",
      documentNumber: `INV-${String(sequence)}`,
      issuedOn: "2026-08-29",
      supplierDetails,
      buyerDetails,
      totalNetMinor: 10_000n,
      totalTaxMinor: 0n,
      totalGrossMinor: 10_000n,
      templateName: "Payment invoice",
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertDocumentFile(
  companyId: string,
  overrides: Partial<typeof files.$inferInsert> = {},
) {
  const id = overrides.id ?? randomUUID();
  const rows = await dbClient.db
    .insert(files)
    .values({
      id,
      companyId,
      purpose: "document",
      mimeType: "application/pdf",
      byteSize: 1024n,
      objectKey: `${companyId}/documents/${id}`,
      status: "ready",
      checksumSha256: "a".repeat(64),
      stagingPurgedAt: new Date("2026-08-29T00:00:00.000Z"),
      ...overrides,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertJob(
  values: Omit<typeof documentGenerationJobs.$inferInsert, "status"> &
    Partial<typeof documentGenerationJobs.$inferInsert>,
) {
  const rows = await dbClient.db
    .insert(documentGenerationJobs)
    .values(values)
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

describe("document generation jobs schema slice", () => {
  it("creates only the card-named columns and omits error_code / year / templates", async () => {
    const result = await admin.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'document_generation_jobs'
       ORDER BY ordinal_position`,
    );
    const names = result.rows.map((row) => row.column_name);
    expect(names).toEqual([
      "id",
      "company_id",
      "document_id",
      "status",
      "file_id",
      "created_at",
      "updated_at",
    ]);
    for (const forbidden of [
      "error_code",
      "error",
      "year",
      "template_id",
      "pdf_url",
    ]) {
      expect(names).not.toContain(forbidden);
    }
    for (const row of result.rows) {
      if (row.column_name.endsWith("_at")) {
        expect(row.data_type).toBe("timestamp with time zone");
      }
    }
    const byColumn = new Map(result.rows.map((row) => [row.column_name, row]));
    expect(byColumn.get("file_id")?.is_nullable).toBe("YES");
    expect(byColumn.get("document_id")?.is_nullable).toBe("NO");
    expect(byColumn.get("status")?.column_default).toContain("pending");

    const extra = await admin.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'default_document_templates',
           'document_generation_queue'
         )`,
    );
    expect(extra.rows).toEqual([]);
  });

  it("types file_id as optional and status as string", () => {
    expectTypeOf<
      (typeof documentGenerationJobs.$inferSelect)["fileId"]
    >().toEqualTypeOf<string | null>();
    expectTypeOf<
      (typeof documentGenerationJobs.$inferSelect)["status"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof documentGenerationJobs.$inferInsert)["status"]
    >().toEqualTypeOf<string | undefined>();
  });

  it("declares UNIQUE (company_id, id), one job per document_id, and the file index", async () => {
    const result = await admin.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'document_generation_jobs'`,
    );
    const indexes = new Map(
      result.rows.map((row) => [row.indexname, row.indexdef]),
    );

    expect(indexes.get("document_generation_jobs_company_id_id_uq")).toContain(
      "UNIQUE",
    );
    expect(indexes.get("document_generation_jobs_company_id_id_uq")).toContain(
      "(company_id, id)",
    );
    expect(indexes.get("document_generation_jobs_document_id_uq")).toContain(
      "UNIQUE",
    );
    expect(indexes.get("document_generation_jobs_document_id_uq")).toContain(
      "(document_id)",
    );
    expect(indexes.get("document_generation_jobs_document_id_uq")).not.toMatch(
      /WHERE/i,
    );
    expect(indexes.get("document_generation_jobs_file_idx")).toContain(
      "(file_id)",
    );
  });

  it("declares composite same-tenant foreign keys (ADR-0025)", async () => {
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
         AND rel.relname = 'document_generation_jobs'
       ORDER BY con.conname`,
    );
    const defs = new Map(
      result.rows.map((row) => [row.conname, row.definition]),
    );

    expect(
      defs.get("document_generation_jobs_company_id_companies_id_fk"),
    ).toContain("FOREIGN KEY (company_id) REFERENCES companies(id)");
    expect(
      defs.get("document_generation_jobs_company_id_companies_id_fk"),
    ).toContain("ON DELETE CASCADE");
    expect(defs.get("document_generation_jobs_documents_company_fk")).toContain(
      "(company_id, document_id) REFERENCES documents(company_id, id)",
    );
    expect(defs.get("document_generation_jobs_documents_company_fk")).toContain(
      "ON DELETE CASCADE",
    );
    expect(defs.get("document_generation_jobs_files_company_fk")).toContain(
      "(company_id, file_id) REFERENCES files(company_id, id)",
    );
    expect(defs.get("document_generation_jobs_files_company_fk")).toContain(
      "ON DELETE RESTRICT",
    );
  });

  it("rejects illegal status and accepts pending, ready, and failed", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const other = await insertDocument({
      companyId: company.id,
      orderId: order.id,
      type: "delivery_note",
    });
    const otherOrder = await insertOrder({ companyId: company.id });
    const third = await insertDocument({
      companyId: company.id,
      orderId: otherOrder.id,
    });

    await expectSqlState(
      insertJob({
        companyId: company.id,
        documentId: document.id,
        status: "queued",
      }),
      "23514",
    );
    await expectSqlState(
      insertJob({
        companyId: company.id,
        documentId: document.id,
        status: "done",
      }),
      "23514",
    );

    const pending = await insertJob({
      companyId: company.id,
      documentId: document.id,
    });
    expect(pending.status).toBe("pending");
    expect(pending.fileId).toBeNull();

    const readyFile = await insertDocumentFile(company.id);
    const ready = await insertJob({
      companyId: company.id,
      documentId: other.id,
      status: "ready",
      fileId: readyFile.id,
    });
    expect(ready.status).toBe("ready");
    expect(ready.fileId).toBe(readyFile.id);

    const failed = await insertJob({
      companyId: company.id,
      documentId: third.id,
      status: "failed",
    });
    expect(failed.status).toBe("failed");
    expect(failed.fileId).toBeNull();
  });

  it("enforces unique one job per document_id", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const other = await insertDocument({
      companyId: company.id,
      orderId: order.id,
      type: "delivery_note",
    });

    await insertJob({
      companyId: company.id,
      documentId: document.id,
    });
    await expectSqlState(
      insertJob({
        companyId: company.id,
        documentId: document.id,
      }),
      "23505",
    );

    const second = await insertJob({
      companyId: company.id,
      documentId: other.id,
    });
    expect(second.documentId).toBe(other.id);
  });

  it("rejects a job that points at another tenant's document or file", async () => {
    const companyA = await insertCompany();
    const companyB = await insertCompany();
    const orderA = await insertOrder({ companyId: companyA.id });
    const orderB = await insertOrder({ companyId: companyB.id });
    const documentA = await insertDocument({
      companyId: companyA.id,
      orderId: orderA.id,
    });
    const documentB = await insertDocument({
      companyId: companyB.id,
      orderId: orderB.id,
    });
    const fileB = await insertDocumentFile(companyB.id);

    await expectSqlState(
      insertJob({
        companyId: companyA.id,
        documentId: documentB.id,
      }),
      "23503",
    );
    await expectSqlState(
      insertJob({
        companyId: companyA.id,
        documentId: documentA.id,
        fileId: fileB.id,
      }),
      "23503",
    );
  });

  it("restricts file deletes while a job references the file", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const file = await insertDocumentFile(company.id);
    const unused = await insertDocumentFile(company.id);
    await insertJob({
      companyId: company.id,
      documentId: document.id,
      status: "ready",
      fileId: file.id,
    });

    await expectSqlState(
      dbClient.db.delete(files).where(eq(files.id, file.id)),
      "23503",
    );

    await dbClient.db.delete(files).where(eq(files.id, unused.id));
    expect(
      await dbClient.db.select().from(files).where(eq(files.id, unused.id)),
    ).toEqual([]);
  });

  it("cascades document deletion to the job and company wipe to jobs", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const file = await insertDocumentFile(company.id);
    const job = await insertJob({
      companyId: company.id,
      documentId: document.id,
      status: "ready",
      fileId: file.id,
    });

    await dbClient.db.delete(documents).where(eq(documents.id, document.id));
    expect(
      await dbClient.db
        .select()
        .from(documentGenerationJobs)
        .where(eq(documentGenerationJobs.id, job.id)),
    ).toEqual([]);
    expect(
      await dbClient.db.select().from(files).where(eq(files.id, file.id)),
    ).toHaveLength(1);
    expect(
      await dbClient.db.select().from(orders).where(eq(orders.id, order.id)),
    ).toHaveLength(1);

    const surviving = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    await insertJob({
      companyId: company.id,
      documentId: surviving.id,
      fileId: file.id,
      status: "ready",
    });
    await dbClient.db.delete(companies).where(eq(companies.id, company.id));
    expect(
      await dbClient.db
        .select()
        .from(documentGenerationJobs)
        .where(eq(documentGenerationJobs.companyId, company.id)),
    ).toEqual([]);
    expect(
      await dbClient.db
        .select()
        .from(files)
        .where(eq(files.companyId, company.id)),
    ).toEqual([]);
  });

  it("attaches the shared updated_at trigger to document_generation_jobs", async () => {
    const result = await admin.query<{ tgname: string }>(
      `SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND t.tgname LIKE '%_set_updated_at'
         AND c.relname = 'document_generation_jobs'`,
    );
    expect(result.rows.map((row) => row.tgname)).toEqual([
      "document_generation_jobs_set_updated_at",
    ]);

    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const job = await insertJob({
      companyId: company.id,
      documentId: document.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await dbClient.db
      .update(documentGenerationJobs)
      .set({ status: "failed" })
      .where(eq(documentGenerationJobs.id, job.id))
      .returning();
    expect(updated[0]?.updatedAt.getTime()).toBeGreaterThan(
      job.updatedAt.getTime(),
    );
  });
});
