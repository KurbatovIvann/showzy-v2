/**
 * SHO-254 (doc-signing-T1) verification for `signing_requests` and
 * `signing_signatures`. Data-path assertions use Drizzle through the
 * runtime role; raw SQL is limited to PostgreSQL catalog structure checks.
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
import { signingRequests, signingSignatures } from "./schema/doc-signing.js";
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
const payloadSha256 = "a".repeat(64);

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
      name: `Sign Co ${String(sequence)}`,
      slug: `sign-co-${String(sequence)}`,
      prefix: `S${String(sequence)}`,
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
      issuedOn: "2026-08-30",
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
      checksumSha256: payloadSha256,
      stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
      ...overrides,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertSigningFile(
  companyId: string,
  overrides: Partial<typeof files.$inferInsert> = {},
) {
  const id = overrides.id ?? randomUUID();
  const rows = await dbClient.db
    .insert(files)
    .values({
      id,
      companyId,
      purpose: "signing",
      mimeType: "application/vnd.etsi.asic-e+zip",
      byteSize: 2048n,
      objectKey: `${companyId}/signing/${id}`,
      status: "ready",
      checksumSha256: "b".repeat(64),
      stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
      ...overrides,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertRequest(
  values: Omit<typeof signingRequests.$inferInsert, "payloadSha256"> &
    Partial<typeof signingRequests.$inferInsert>,
) {
  const rows = await dbClient.db
    .insert(signingRequests)
    .values({
      payloadSha256,
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertSignature(
  values: Omit<
    typeof signingSignatures.$inferInsert,
    "signerRole" | "signerCn" | "signerOrg" | "signerTaxId" | "signatureAlg"
  > &
    Partial<typeof signingSignatures.$inferInsert>,
) {
  const rows = await dbClient.db
    .insert(signingSignatures)
    .values({
      signerRole: "supplier",
      signerCn: "ФОП Fixture",
      signerOrg: "Fixture Org",
      signerTaxId: "12345678",
      signatureAlg: "DSTU4145",
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

describe("signing_requests / signing_signatures schema slice", () => {
  it("creates only the card-named columns and omits key/signature bytes", async () => {
    const requestColumns = await admin.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'signing_requests'
       ORDER BY ordinal_position`,
    );
    expect(requestColumns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "company_id",
      "document_id",
      "payload_file_id",
      "payload_sha256",
      "payload_digest_algorithm",
      "status",
      "created_at",
      "updated_at",
    ]);
    const requestByColumn = new Map(
      requestColumns.rows.map((row) => [row.column_name, row]),
    );
    expect(requestByColumn.get("payload_file_id")?.is_nullable).toBe("NO");
    expect(requestByColumn.get("status")?.column_default).toContain("pending");
    expect(
      requestByColumn.get("payload_digest_algorithm")?.column_default,
    ).toContain("sha256");
    for (const row of requestColumns.rows) {
      if (row.column_name.endsWith("_at")) {
        expect(row.data_type).toBe("timestamp with time zone");
      }
    }

    const signatureColumns = await admin.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'signing_signatures'
       ORDER BY ordinal_position`,
    );
    expect(signatureColumns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "company_id",
      "document_id",
      "signer_role",
      "file_id",
      "signer_cn",
      "signer_org",
      "signer_tax_id",
      "signature_alg",
      "signed_at",
      "created_at",
    ]);
    for (const forbidden of [
      "signature_bytes",
      "raw_key",
      "private_key",
      "certificate_pem",
      "signature",
      "sign_requested_at",
    ]) {
      expect(requestColumns.rows.map((row) => row.column_name)).not.toContain(
        forbidden,
      );
      expect(signatureColumns.rows.map((row) => row.column_name)).not.toContain(
        forbidden,
      );
    }
    for (const row of signatureColumns.rows) {
      if (row.column_name.endsWith("_at")) {
        expect(row.data_type).toBe("timestamp with time zone");
      }
    }
  });

  it("types payload digest and signer role as strings", () => {
    expectTypeOf<
      (typeof signingRequests.$inferSelect)["payloadSha256"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof signingRequests.$inferSelect)["status"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof signingSignatures.$inferSelect)["signerRole"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof signingSignatures.$inferSelect)["fileId"]
    >().toEqualTypeOf<string>();
  });

  it("declares UNIQUE (company_id, id), pending-per-document, and unique supplier", async () => {
    const requestIndexes = await admin.query<{
      indexname: string;
      indexdef: string;
    }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'signing_requests'`,
    );
    const requests = new Map(
      requestIndexes.rows.map((row) => [row.indexname, row.indexdef]),
    );
    expect(requests.get("signing_requests_company_id_id_uq")).toContain(
      "UNIQUE",
    );
    expect(requests.get("signing_requests_company_id_id_uq")).toContain(
      "(company_id, id)",
    );
    expect(requests.get("signing_requests_document_id_pending_uq")).toContain(
      "UNIQUE",
    );
    expect(requests.get("signing_requests_document_id_pending_uq")).toContain(
      "(document_id)",
    );
    expect(requests.get("signing_requests_document_id_pending_uq")).toMatch(
      /WHERE/i,
    );
    expect(requests.get("signing_requests_document_id_pending_uq")).toContain(
      "pending",
    );

    const signatureIndexes = await admin.query<{
      indexname: string;
      indexdef: string;
    }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'signing_signatures'`,
    );
    const signatures = new Map(
      signatureIndexes.rows.map((row) => [row.indexname, row.indexdef]),
    );
    expect(signatures.get("signing_signatures_company_id_id_uq")).toContain(
      "(company_id, id)",
    );
    expect(
      signatures.get("signing_signatures_document_id_signer_role_uq"),
    ).toContain("UNIQUE");
    expect(
      signatures.get("signing_signatures_document_id_signer_role_uq"),
    ).toContain("(document_id, signer_role)");
  });

  it("declares composite same-tenant foreign keys with RESTRICT (ADR-0025)", async () => {
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
         AND rel.relname IN ('signing_requests', 'signing_signatures')
       ORDER BY con.conname`,
    );
    const defs = new Map(
      result.rows.map((row) => [row.conname, row.definition]),
    );

    expect(defs.get("signing_requests_company_id_companies_id_fk")).toContain(
      "FOREIGN KEY (company_id) REFERENCES companies(id)",
    );
    expect(defs.get("signing_requests_company_id_companies_id_fk")).toContain(
      "ON DELETE CASCADE",
    );
    expect(defs.get("signing_requests_documents_company_fk")).toContain(
      "(company_id, document_id) REFERENCES documents(company_id, id)",
    );
    expect(defs.get("signing_requests_documents_company_fk")).toContain(
      "ON DELETE RESTRICT",
    );
    expect(defs.get("signing_requests_payload_files_company_fk")).toContain(
      "(company_id, payload_file_id) REFERENCES files(company_id, id)",
    );
    expect(defs.get("signing_requests_payload_files_company_fk")).toContain(
      "ON DELETE RESTRICT",
    );

    expect(defs.get("signing_signatures_company_id_companies_id_fk")).toContain(
      "ON DELETE CASCADE",
    );
    expect(defs.get("signing_signatures_documents_company_fk")).toContain(
      "(company_id, document_id) REFERENCES documents(company_id, id)",
    );
    expect(defs.get("signing_signatures_documents_company_fk")).toContain(
      "ON DELETE RESTRICT",
    );
    expect(defs.get("signing_signatures_files_company_fk")).toContain(
      "(company_id, file_id) REFERENCES files(company_id, id)",
    );
    expect(defs.get("signing_signatures_files_company_fk")).toContain(
      "ON DELETE RESTRICT",
    );
  });

  it("rejects illegal status, digest, and signer_role values", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const payload = await insertDocumentFile(company.id);
    const asic = await insertSigningFile(company.id);

    await expectSqlState(
      insertRequest({
        companyId: company.id,
        documentId: document.id,
        payloadFileId: payload.id,
        status: "failed",
      }),
      "23514",
    );
    await expectSqlState(
      insertRequest({
        companyId: company.id,
        documentId: document.id,
        payloadFileId: payload.id,
        payloadSha256: "not-hex",
      }),
      "23514",
    );
    await expectSqlState(
      insertRequest({
        companyId: company.id,
        documentId: document.id,
        payloadFileId: payload.id,
        payloadDigestAlgorithm: "md5",
      }),
      "23514",
    );

    const pending = await insertRequest({
      companyId: company.id,
      documentId: document.id,
      payloadFileId: payload.id,
    });
    expect(pending.status).toBe("pending");
    expect(pending.payloadDigestAlgorithm).toBe("sha256");

    await expectSqlState(
      insertSignature({
        companyId: company.id,
        documentId: document.id,
        fileId: asic.id,
        signerRole: "counterparty",
        signedAt: new Date("2026-08-30T12:00:00.000Z"),
      }),
      "23514",
    );

    const signature = await insertSignature({
      companyId: company.id,
      documentId: document.id,
      fileId: asic.id,
      signedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    expect(signature.signerRole).toBe("supplier");
  });

  it("enforces one live pending request per document and unique supplier", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const first = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const second = await insertDocument({
      companyId: company.id,
      orderId: order.id,
      type: "delivery_note",
    });
    const payload = await insertDocumentFile(company.id);
    const asic = await insertSigningFile(company.id);

    await insertRequest({
      companyId: company.id,
      documentId: first.id,
      payloadFileId: payload.id,
    });
    await expectSqlState(
      insertRequest({
        companyId: company.id,
        documentId: first.id,
        payloadFileId: payload.id,
      }),
      "23505",
    );

    const otherPending = await insertRequest({
      companyId: company.id,
      documentId: second.id,
      payloadFileId: payload.id,
    });
    expect(otherPending.documentId).toBe(second.id);

    const completed = await insertRequest({
      companyId: company.id,
      documentId: first.id,
      payloadFileId: payload.id,
      status: "completed",
    });
    expect(completed.status).toBe("completed");

    await insertSignature({
      companyId: company.id,
      documentId: first.id,
      fileId: asic.id,
      signedAt: new Date("2026-08-30T12:00:00.000Z"),
    });
    await expectSqlState(
      insertSignature({
        companyId: company.id,
        documentId: first.id,
        fileId: asic.id,
        signedAt: new Date("2026-08-30T12:01:00.000Z"),
      }),
      "23505",
    );
  });

  it("rejects a request or signature that points at another tenant", async () => {
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
    const payloadA = await insertDocumentFile(companyA.id);
    const payloadB = await insertDocumentFile(companyB.id);
    const asicB = await insertSigningFile(companyB.id);

    await expectSqlState(
      insertRequest({
        companyId: companyA.id,
        documentId: documentB.id,
        payloadFileId: payloadA.id,
      }),
      "23503",
    );
    await expectSqlState(
      insertRequest({
        companyId: companyA.id,
        documentId: documentA.id,
        payloadFileId: payloadB.id,
      }),
      "23503",
    );
    await expectSqlState(
      insertSignature({
        companyId: companyA.id,
        documentId: documentB.id,
        fileId: asicB.id,
        signedAt: new Date("2026-08-30T12:00:00.000Z"),
      }),
      "23503",
    );
  });

  it("restricts document and file deletes while signing rows reference them", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const unusedDocument = await insertDocument({
      companyId: company.id,
      orderId: order.id,
      type: "delivery_note",
    });
    const payload = await insertDocumentFile(company.id);
    const unusedPayload = await insertDocumentFile(company.id);
    const asic = await insertSigningFile(company.id);
    const unusedAsic = await insertSigningFile(company.id);
    await insertRequest({
      companyId: company.id,
      documentId: document.id,
      payloadFileId: payload.id,
    });
    await insertSignature({
      companyId: company.id,
      documentId: document.id,
      fileId: asic.id,
      signedAt: new Date("2026-08-30T12:00:00.000Z"),
    });

    await expectSqlState(
      dbClient.db.delete(documents).where(eq(documents.id, document.id)),
      "23503",
    );
    await expectSqlState(
      dbClient.db.delete(files).where(eq(files.id, payload.id)),
      "23503",
    );
    await expectSqlState(
      dbClient.db.delete(files).where(eq(files.id, asic.id)),
      "23503",
    );

    await dbClient.db
      .delete(documents)
      .where(eq(documents.id, unusedDocument.id));
    await dbClient.db.delete(files).where(eq(files.id, unusedPayload.id));
    await dbClient.db.delete(files).where(eq(files.id, unusedAsic.id));
  });

  it("cascades company wipe to signing rows", async () => {
    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const payload = await insertDocumentFile(company.id);
    const asic = await insertSigningFile(company.id);
    await insertRequest({
      companyId: company.id,
      documentId: document.id,
      payloadFileId: payload.id,
    });
    await insertSignature({
      companyId: company.id,
      documentId: document.id,
      fileId: asic.id,
      signedAt: new Date("2026-08-30T12:00:00.000Z"),
    });

    await dbClient.db.delete(companies).where(eq(companies.id, company.id));
    expect(
      await dbClient.db
        .select()
        .from(signingRequests)
        .where(eq(signingRequests.companyId, company.id)),
    ).toEqual([]);
    expect(
      await dbClient.db
        .select()
        .from(signingSignatures)
        .where(eq(signingSignatures.companyId, company.id)),
    ).toEqual([]);
  });

  it("attaches the shared updated_at trigger to signing_requests", async () => {
    const result = await admin.query<{ tgname: string }>(
      `SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND t.tgname LIKE '%_set_updated_at'
         AND c.relname = 'signing_requests'`,
    );
    expect(result.rows.map((row) => row.tgname)).toEqual([
      "signing_requests_set_updated_at",
    ]);

    const company = await insertCompany();
    const order = await insertOrder({ companyId: company.id });
    const document = await insertDocument({
      companyId: company.id,
      orderId: order.id,
    });
    const payload = await insertDocumentFile(company.id);
    const request = await insertRequest({
      companyId: company.id,
      documentId: document.id,
      payloadFileId: payload.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await dbClient.db
      .update(signingRequests)
      .set({ status: "completed" })
      .where(eq(signingRequests.id, request.id))
      .returning();
    expect(updated[0]?.updatedAt.getTime()).toBeGreaterThan(
      request.updatedAt.getTime(),
    );
  });
});
