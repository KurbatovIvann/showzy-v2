/**
 * SHO-110 (files-T1) verification for the private company-file schema.
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

import { rolePermissionDefaultRows } from "../seed/role-permission-defaults.js";
import type { DbClient } from "./client.js";
import type { UserId } from "./schema/auth-ids.js";
import { user } from "./schema/auth.js";
import { companies } from "./schema/companies.js";
import { files } from "./schema/files.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

let database: TestDatabase;
let dbClient: DbClient;
let admin: pg.Client;
let sequence = 0;

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

async function insertUser(): Promise<UserId> {
  sequence += 1;
  const id = `files_user_${String(sequence)}`;
  await dbClient.db.insert(user).values({
    id,
    name: `Files User ${String(sequence)}`,
    email: `files-user-${String(sequence)}@example.com`,
  });
  return id;
}

async function insertCompany() {
  sequence += 1;
  const rows = await dbClient.db
    .insert(companies)
    .values({
      name: `Files Co ${String(sequence)}`,
      slug: `files-co-${String(sequence)}`,
      prefix: `F${String(sequence)}`,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function insertFile(
  values: Omit<
    typeof files.$inferInsert,
    "purpose" | "mimeType" | "byteSize" | "objectKey"
  > &
    Partial<typeof files.$inferInsert>,
) {
  const id = values.id ?? randomUUID();
  const rows = await dbClient.db
    .insert(files)
    .values({
      id,
      purpose: "catalog",
      mimeType: "image/jpeg",
      byteSize: 0n,
      objectKey: `${values.companyId}/catalog/${id}`,
      ...values,
    })
    .returning();
  const row = rows[0];
  assert.ok(row);
  return row;
}

describe("private company files schema slice", () => {
  it("creates only the card-named columns with timestamptz timestamps", async () => {
    const result = await admin.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'files'
       ORDER BY ordinal_position`,
    );
    const names = result.rows.map((row) => row.column_name);
    expect(names).toEqual([
      "id",
      "company_id",
      "uploaded_by_user_id",
      "purpose",
      "object_key",
      "mime_type",
      "byte_size",
      "checksum_sha256",
      "status",
      "created_at",
      "updated_at",
      "staging_purged_at",
    ]);
    for (const row of result.rows) {
      if (row.column_name.endsWith("_at")) {
        expect(row.data_type).toBe("timestamp with time zone");
      }
    }
    const byteSize = result.rows.find((row) => row.column_name === "byte_size");
    expect(byteSize?.data_type).toBe("bigint");
    const checksum = result.rows.find(
      (row) => row.column_name === "checksum_sha256",
    );
    expect(checksum?.is_nullable).toBe("YES");
    const status = result.rows.find((row) => row.column_name === "status");
    expect(status?.column_default).toContain("pending");
    const stagingPurgedAt = result.rows.find(
      (row) => row.column_name === "staging_purged_at",
    );
    expect(stagingPurgedAt?.data_type).toBe("timestamp with time zone");
    expect(stagingPurgedAt?.is_nullable).toBe("YES");
    expect(stagingPurgedAt?.column_default).toBeNull();
    for (const forbidden of [
      "public_url",
      "url",
      "bucket",
      "bucket_name",
      "cdn_url",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("does not create extra purpose tables", async () => {
    // `documents` is owned by the documents module (SHO-228), not a files
    // purpose table. Files still must not grow avatars (or other purpose
    // tables). Purpose remains `catalog` until files-T14.
    const result = await admin.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('avatars')`,
    );
    expect(result.rows).toEqual([]);
  });

  it("represents byte_size as bigint and the uploader as the generated user id", () => {
    expectTypeOf<
      (typeof files.$inferSelect)["byteSize"]
    >().toEqualTypeOf<bigint>();
    expectTypeOf<
      (typeof files.$inferInsert)["uploadedByUserId"]
    >().toEqualTypeOf<UserId>();
  });

  it("declares UNIQUE (company_id, id), UNIQUE (company_id, object_key), tenant indexes, and sweep indexes", async () => {
    const result = await admin.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'files'`,
    );
    const indexes = new Map(
      result.rows.map((row) => [row.indexname, row.indexdef]),
    );

    expect(indexes.get("files_company_id_id_uq")).toContain("UNIQUE");
    expect(indexes.get("files_company_id_id_uq")).toContain("(company_id, id)");
    expect(indexes.get("files_company_object_key_uq")).toContain("UNIQUE");
    expect(indexes.get("files_company_object_key_uq")).toContain(
      "(company_id, object_key)",
    );
    expect(indexes.get("files_company_idx")).toContain("(company_id)");
    expect(indexes.get("files_company_status_idx")).toContain(
      "(company_id, status)",
    );
    expect(indexes.get("files_uploaded_by_user_idx")).toContain(
      "(uploaded_by_user_id)",
    );
    expect(indexes.get("files_status_created_at_id_idx")).toContain(
      "(status, created_at, id)",
    );
    const leftoverSweep = indexes.get("files_ready_leftover_sweep_idx");
    expect(leftoverSweep).toContain("(updated_at, id)");
    expect(leftoverSweep).toMatch(/status = 'ready'/);
    expect(leftoverSweep).toMatch(/staging_purged_at IS NULL/);
    expect(leftoverSweep).not.toContain("UNIQUE");
  });

  it("declares company CASCADE and uploader RESTRICT foreign keys", async () => {
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
         AND rel.relname = 'files'
       ORDER BY con.conname`,
    );
    const defs = new Map(
      result.rows.map((row) => [row.conname, row.definition]),
    );

    expect(defs.get("files_company_id_companies_id_fk")).toContain(
      "FOREIGN KEY (company_id) REFERENCES companies(id)",
    );
    expect(defs.get("files_company_id_companies_id_fk")).toContain(
      "ON DELETE CASCADE",
    );
    expect(defs.get("files_uploaded_by_user_id_user_id_fk")).toContain(
      "FOREIGN KEY (uploaded_by_user_id) REFERENCES",
    );
    expect(defs.get("files_uploaded_by_user_id_user_id_fk")).toContain(
      "ON DELETE RESTRICT",
    );
  });

  it("declares the catalog object_key prefix CHECK", async () => {
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
         AND con.contype = 'c'
         AND rel.relname = 'files'`,
    );
    const defs = new Map(
      result.rows.map((row) => [row.conname, row.definition]),
    );
    expect(defs.get("files_object_key_catalog_prefix_check")).toContain(
      "object_key",
    );
    expect(defs.get("files_object_key_catalog_prefix_check")).toContain(
      "/catalog/",
    );
  });

  it("rejects illegal purpose, status, negative byte_size, and malformed checksums", async () => {
    const company = await insertCompany();
    const userId = await insertUser();

    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        purpose: "documents",
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        purpose: "chat",
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        purpose: "avatar",
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        status: "quarantined",
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        byteSize: -1n,
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        checksumSha256: "not-a-checksum",
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        companyId: company.id,
        uploadedByUserId: userId,
        checksumSha256: "A".repeat(64),
      }),
      "23514",
    );

    const pending = await insertFile({
      companyId: company.id,
      uploadedByUserId: userId,
      byteSize: 0n,
    });
    expect(pending.status).toBe("pending");
    expect(pending.byteSize).toBe(0n);
    expect(pending.checksumSha256).toBeNull();
    expect(pending.purpose).toBe("catalog");

    const ready = await insertFile({
      companyId: company.id,
      uploadedByUserId: userId,
      status: "ready",
      byteSize: 1024n,
      checksumSha256: "a".repeat(64),
    });
    expect(ready.status).toBe("ready");
    expect(ready.checksumSha256).toBe("a".repeat(64));
    expect(ready.stagingPurgedAt).toBeNull();
  });

  it("rejects object_key values that are not {company_id}/catalog/{id}", async () => {
    const company = await insertCompany();
    const userId = await insertUser();
    const id = randomUUID();

    await expectSqlState(
      insertFile({
        id,
        companyId: company.id,
        uploadedByUserId: userId,
        objectKey: `${company.id}/documents/${id}`,
      }),
      "23514",
    );
    await expectSqlState(
      insertFile({
        id,
        companyId: company.id,
        uploadedByUserId: userId,
        objectKey: `${randomUUID()}/catalog/${id}`,
      }),
      "23514",
    );

    const row = await insertFile({
      id,
      companyId: company.id,
      uploadedByUserId: userId,
    });
    expect(row.objectKey).toBe(`${company.id}/catalog/${id}`);
  });

  it("keeps object keys unique per tenant; other tenants use their own prefix", async () => {
    const companyA = await insertCompany();
    const companyB = await insertCompany();
    const userA = await insertUser();
    const userB = await insertUser();
    const id = randomUUID();

    const fileA = await insertFile({
      id,
      companyId: companyA.id,
      uploadedByUserId: userA,
    });
    await expectSqlState(
      insertFile({
        id,
        companyId: companyA.id,
        uploadedByUserId: userA,
      }),
      "23505",
    );

    const fileB = await insertFile({
      companyId: companyB.id,
      uploadedByUserId: userB,
    });
    expect(fileA.objectKey).toBe(`${companyA.id}/catalog/${id}`);
    expect(fileB.objectKey).toBe(`${companyB.id}/catalog/${fileB.id}`);
    expect(fileB.objectKey).not.toBe(fileA.objectKey);
  });

  it("cascades company deletion and restricts deleting an uploader with files", async () => {
    const company = await insertCompany();
    const uploader = await insertUser();
    const other = await insertUser();
    const row = await insertFile({
      companyId: company.id,
      uploadedByUserId: uploader,
    });

    await expectSqlState(
      dbClient.db.delete(user).where(eq(user.id, uploader)),
      "23503",
    );

    await dbClient.db.delete(user).where(eq(user.id, other));

    await dbClient.db.delete(companies).where(eq(companies.id, company.id));
    expect(
      await dbClient.db.select().from(files).where(eq(files.id, row.id)),
    ).toEqual([]);

    await dbClient.db.delete(user).where(eq(user.id, uploader));
  });

  it("attaches the shared updated_at trigger to files", async () => {
    const result = await admin.query<{ tgname: string }>(
      `SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND t.tgname LIKE '%_set_updated_at'
         AND c.relname = 'files'`,
    );
    expect(result.rows.map((row) => row.tgname)).toEqual([
      "files_set_updated_at",
    ]);

    const company = await insertCompany();
    const userId = await insertUser();
    const row = await insertFile({
      companyId: company.id,
      uploadedByUserId: userId,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await dbClient.db
      .update(files)
      .set({ status: "ready" })
      .where(eq(files.id, row.id))
      .returning();
    expect(updated[0]?.updatedAt.getTime()).toBeGreaterThan(
      row.updatedAt.getTime(),
    );
  });

  it("seeds files:view and files:upload for admin and manager, not employee", () => {
    const keys = new Set(
      rolePermissionDefaultRows.map((row) => `${row.role}:${row.permission}`),
    );
    for (const role of ["admin", "manager"] as const) {
      expect(keys.has(`${role}:files:view`)).toBe(true);
      expect(keys.has(`${role}:files:upload`)).toBe(true);
    }
    expect(keys.has("employee:files:view")).toBe(false);
    expect(keys.has("employee:files:upload")).toBe(false);
    expect(keys.has("owner:files:view")).toBe(false);
  });
});
