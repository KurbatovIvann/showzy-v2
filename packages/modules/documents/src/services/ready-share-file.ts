import type { ReadTx } from "@showzy/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * Same-database read of the generation projection's `file_id` so share can
 * mint via `files.issueShareDownloadUrl` when a job is ready. Not an owned
 * documents table (ADR-0014). SHO-236 may replace this with `ctx.call`
 * `doc-generation.getArtifact`. Do not import `@showzy/db/schema/doc-generation`.
 */
const documentGenerationJobsRead = pgTable("document_generation_jobs", {
  companyId: uuid("company_id").notNull(),
  documentId: uuid("document_id").notNull(),
  status: text("status").notNull(),
  fileId: uuid("file_id"),
});

export async function loadReadyShareFileId(env: {
  readonly db: ReadTx;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<string | null> {
  const rows = await env.db
    .select({ fileId: documentGenerationJobsRead.fileId })
    .from(documentGenerationJobsRead)
    .where(
      and(
        eq(documentGenerationJobsRead.companyId, env.companyId),
        eq(documentGenerationJobsRead.documentId, env.documentId),
        eq(documentGenerationJobsRead.status, "ready"),
        isNotNull(documentGenerationJobsRead.fileId),
      ),
    )
    .limit(1);
  const fileId = rows[0]?.fileId;
  return fileId === undefined ? null : fileId;
}
