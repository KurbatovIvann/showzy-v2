/**
 * Private company file metadata (SHO-110 / SHO-111 / SHO-229 / SHO-253).
 * Owned by the files module (ADR-0014). Object bytes live in S3
 * (`config.s3.bucket`); this table stores only tenant-scoped metadata.
 * Deliberately absent: public URL, bucket name, extra purposes (`chat` /
 * `avatar`), `product_media`.
 *
 * `object_key` is server-derived: `{companyId}/catalog/{fileId}` when
 * `purpose = catalog`, `{companyId}/documents/{fileId}` when
 * `purpose = document`, or `{companyId}/signing/{fileId}` when
 * `purpose = signing`. The CHECK matches prefix to purpose; finalize,
 * `recordGeneratedObject`, and `recordSigningObject` still verify the
 * prefix (security-operations.md §3). Handshake PUT uses
 * `{companyId}/uploads/{fileId}` derived in code and is never stored
 * (SHO-113). `staging_purged_at` is the ready leftover GC cursor
 * (SHO-117); generated PDFs set it at insert (no handshake).
 *
 * `uploaded_by_user_id` is nullable: catalog `requestUpload` and signing
 * `requestSigningUpload` write the staff user; generated PDFs may be null.
 * Signing ready rows keep that staff user (not null).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { userIdColumn } from "./auth-ids.js";
import {
  tenantCompanyId,
  tenantRowUnique,
  timestampColumns,
} from "./tenant-columns.js";

/**
 * One row per uploaded or generated object. Catalog and signing handshake
 * PUT targets `{companyId}/uploads/{fileId}` and is never stored. `pending`
 * rows may have `byte_size = 0` and a null checksum until finalize.
 * Generated documents are inserted `ready` with a documents-prefix key.
 * Signing rows stay `pending` until `recordSigningObject` (not catalog
 * finalize) copies staging onto the signing prefix.
 */
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: tenantCompanyId(),
    uploadedByUserId: userIdColumn("uploaded_by_user_id").references(
      () => user.id,
      { onDelete: "restrict" },
    ),
    purpose: text("purpose").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    status: text("status").notNull().default("pending"),
    ...timestampColumns(),
    stagingPurgedAt: timestamp("staging_purged_at", { withTimezone: true }),
  },
  (table) => [
    tenantRowUnique("files_company_id_id_uq", table),
    unique("files_company_object_key_uq").on(table.companyId, table.objectKey),
    index("files_company_status_idx").on(table.companyId, table.status),
    index("files_uploaded_by_user_idx").on(table.uploadedByUserId),
    index("files_status_created_at_id_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("files_ready_leftover_sweep_idx")
      .on(table.updatedAt, table.id)
      .where(
        sql`${table.status} = 'ready' AND ${table.stagingPurgedAt} IS NULL`,
      ),
    check(
      "files_purpose_check",
      sql`${table.purpose} IN ('catalog', 'document', 'signing')`,
    ),
    check("files_status_check", sql`${table.status} IN ('pending', 'ready')`),
    check("files_byte_size_check", sql`${table.byteSize} >= 0`),
    check(
      "files_checksum_sha256_check",
      sql`${table.checksumSha256} IS NULL OR ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "files_object_key_purpose_prefix_check",
      sql`(${table.purpose} = 'catalog' AND ${table.objectKey} = ${table.companyId}::text || '/catalog/' || ${table.id}::text) OR (${table.purpose} = 'document' AND ${table.objectKey} = ${table.companyId}::text || '/documents/' || ${table.id}::text) OR (${table.purpose} = 'signing' AND ${table.objectKey} = ${table.companyId}::text || '/signing/' || ${table.id}::text)`,
    ),
  ],
);
