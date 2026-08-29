import { implementAction } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import { and, eq } from "drizzle-orm";

import { getArtifactContract } from "./get-artifact.contract.js";

export const getArtifact = implementAction(getArtifactContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("docGeneration.getArtifact expects staff");
    }
    const rows = await ctx.db
      .select({
        status: documentGenerationJobs.status,
        fileId: documentGenerationJobs.fileId,
      })
      .from(documentGenerationJobs)
      .where(
        and(
          eq(documentGenerationJobs.companyId, ctx.companyId),
          eq(documentGenerationJobs.documentId, input.documentId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError();
    }
    if (
      row.status !== "pending" &&
      row.status !== "ready" &&
      row.status !== "failed"
    ) {
      throw new CoreInvariantError(
        `document_generation_jobs row has illegal status "${row.status}"`,
      );
    }
    return { status: row.status, fileId: row.fileId };
  },
});
