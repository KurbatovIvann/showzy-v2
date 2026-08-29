/**
 * Document generation jobs (SHO-232, doc-generation-T1). Owned by the
 * doc-generation module (ADR-0014). One row per document is the idempotent
 * retry target. Deliberately absent: render workers, template tables,
 * `error_code` (no second status machine), year columns.
 *
 * ON DELETE: composite FK to `documents` is CASCADE so deleting a document
 * (or a company wipe that cascades into documents) removes the job. Composite
 * FK to `files` is RESTRICT — T14 did not introduce SET NULL on file delete.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./companies.js";
import { documents } from "./documents.js";
import { files } from "./files.js";

/**
 * One generation job per tenant document. `file_id` is null until the
 * worker records the PDF; MATCH SIMPLE skips the files FK while it is null.
 */
export const documentGenerationJobs = pgTable(
  "document_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(),
    status: text("status").notNull().default("pending"),
    fileId: uuid("file_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("document_generation_jobs_company_id_id_uq").on(
      table.companyId,
      table.id,
    ),
    unique("document_generation_jobs_document_id_uq").on(table.documentId),
    index("document_generation_jobs_file_idx").on(table.fileId),
    foreignKey({
      name: "document_generation_jobs_documents_company_fk",
      columns: [table.companyId, table.documentId],
      foreignColumns: [documents.companyId, documents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "document_generation_jobs_files_company_fk",
      columns: [table.companyId, table.fileId],
      foreignColumns: [files.companyId, files.id],
    }).onDelete("restrict"),
    check(
      "document_generation_jobs_status_check",
      sql`${table.status} IN ('pending', 'ready', 'failed')`,
    ),
  ],
);
