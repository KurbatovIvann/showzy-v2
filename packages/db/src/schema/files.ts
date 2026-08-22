/**
 * Private company file metadata (SHO-110, files-T1). Owned by the files
 * module (ADR-0014). Object bytes live in S3 (`config.s3.bucket`); this
 * table stores only tenant-scoped metadata. Actions and the S3 client are
 * a later ticket. Deliberately absent: public URL, bucket name, extra
 * purposes (`documents` / `chat` / `avatar`), `product_media`.
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
import { companies } from "./companies.js";

/**
 * One row per uploaded object. `object_key` is server-derived
 * `{companyId}/catalog/{fileId}` and unique per tenant. `pending` rows may
 * have `byte_size = 0` and a null checksum until finalize.
 */
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    uploadedByUserId: userIdColumn("uploaded_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("files_company_id_id_uq").on(table.companyId, table.id),
    unique("files_company_object_key_uq").on(table.companyId, table.objectKey),
    index("files_company_idx").on(table.companyId),
    index("files_company_status_idx").on(table.companyId, table.status),
    index("files_uploaded_by_user_idx").on(table.uploadedByUserId),
    check("files_purpose_check", sql`${table.purpose} IN ('catalog')`),
    check("files_status_check", sql`${table.status} IN ('pending', 'ready')`),
    check("files_byte_size_check", sql`${table.byteSize} >= 0`),
    check(
      "files_checksum_sha256_check",
      sql`${table.checksumSha256} IS NULL OR ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
