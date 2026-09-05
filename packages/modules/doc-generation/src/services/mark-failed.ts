import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import { getForGeneration } from "@showzy/documents";
import { postgresUniqueConstraint } from "@showzy/module-kit/postgres-unique";
import { and, eq, ne } from "drizzle-orm";

import { requireWritable } from "./writable.js";

const JOBS_DOCUMENT_ID_UQ = "document_generation_jobs_document_id_uq";

type SystemTenantCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "tenant" }
>;

export type MarkFailedResult = {
  readonly status: "ready" | "failed";
  readonly fileId: string | null;
  readonly documentId: string;
};

type JobRow = {
  readonly status: string;
  readonly fileId: string | null;
};

async function loadJob(
  ctx: SystemTenantCtx,
  documentId: string,
): Promise<JobRow | undefined> {
  const rows = await ctx.db
    .select({
      status: documentGenerationJobs.status,
      fileId: documentGenerationJobs.fileId,
    })
    .from(documentGenerationJobs)
    .where(
      and(
        eq(documentGenerationJobs.companyId, ctx.companyId),
        eq(documentGenerationJobs.documentId, documentId),
      ),
    )
    .limit(1);
  return rows[0];
}

function toResult(
  documentId: string,
  row: JobRow,
): MarkFailedResult | undefined {
  if (row.status === "ready" && row.fileId !== null) {
    return { status: "ready", fileId: row.fileId, documentId };
  }
  if (row.status === "failed") {
    return { status: "failed", fileId: null, documentId };
  }
  return undefined;
}

async function insertFailedJob(
  ctx: SystemTenantCtx,
  documentId: string,
): Promise<void> {
  const db = requireWritable(ctx.db);
  try {
    await db.insert(documentGenerationJobs).values({
      companyId: ctx.companyId,
      documentId,
      status: "failed",
      fileId: null,
    });
  } catch (error) {
    if (postgresUniqueConstraint(error) !== JOBS_DOCUMENT_ID_UQ) {
      throw error;
    }
  }
}

/**
 * Persist failed without clobbering a concurrent ready artifact.
 * Inserts only after `documents.getForGeneration` proves the document
 * exists in this tenant — a foreign id is not-found, not a jobs row.
 */
export async function markTenantDocumentFailed(env: {
  readonly ctx: SystemTenantCtx;
  readonly documentId: string;
}): Promise<MarkFailedResult> {
  const { ctx, documentId } = env;
  const existing = await loadJob(ctx, documentId);
  if (existing !== undefined) {
    const current = toResult(documentId, existing);
    if (current !== undefined) {
      return current;
    }
    const db = requireWritable(ctx.db);
    const updated = await db
      .update(documentGenerationJobs)
      .set({
        status: "failed",
        fileId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentGenerationJobs.companyId, ctx.companyId),
          eq(documentGenerationJobs.documentId, documentId),
          ne(documentGenerationJobs.status, "ready"),
        ),
      )
      .returning({
        status: documentGenerationJobs.status,
        fileId: documentGenerationJobs.fileId,
      });
    const afterUpdate = updated[0] ?? (await loadJob(ctx, documentId));
    if (afterUpdate === undefined) {
      throw new CoreInvariantError(
        "document_generation_jobs row vanished during markFailed",
      );
    }
    const result = toResult(documentId, afterUpdate);
    if (result !== undefined) {
      return result;
    }
    throw new CoreInvariantError(
      `document_generation_jobs row has illegal status "${afterUpdate.status}" after markFailed`,
    );
  }

  await ctx.call(getForGeneration, { documentId });
  await insertFailedJob(ctx, documentId);
  const inserted = await loadJob(ctx, documentId);
  if (inserted === undefined) {
    throw new NotFoundError();
  }
  const result = toResult(documentId, inserted);
  if (result !== undefined) {
    return result;
  }
  throw new CoreInvariantError(
    `document_generation_jobs row has illegal status "${inserted.status}" after markFailed insert`,
  );
}
