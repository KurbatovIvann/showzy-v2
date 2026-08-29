import {
  implementAction,
  type ResolvedTarget,
  type TargetResolutionEnv,
} from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { documentShareTokens } from "@showzy/db/schema/documents";
import { eq } from "drizzle-orm";

import { getSharedContract } from "./get-shared.contract.js";
import { loadStaffDocument } from "../services/load-document.js";
import { storedSharePdfDownloadUrl } from "../services/share-pdf-url.js";
import { hashDocumentShareToken } from "../services/token-hash.js";

export interface SharedTokenResource {
  readonly documentId: string;
  readonly pdfDownloadUrl: string | null;
  readonly pdfDownloadExpiresAt: Date | null;
}

function isSharedTokenResource(value: unknown): value is SharedTokenResource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("documentId" in value) || typeof value.documentId !== "string") {
    return false;
  }
  if (!("pdfDownloadUrl" in value)) {
    return false;
  }
  if (
    value.pdfDownloadUrl !== null &&
    typeof value.pdfDownloadUrl !== "string"
  ) {
    return false;
  }
  if (!("pdfDownloadExpiresAt" in value)) {
    return false;
  }
  return (
    value.pdfDownloadExpiresAt === null ||
    value.pdfDownloadExpiresAt instanceof Date
  );
}

async function resolveSharedDocument(
  input: { token: string },
  env: TargetResolutionEnv,
): Promise<ResolvedTarget<SharedTokenResource>> {
  if (env.principal.mode !== "public") {
    throw new NotFoundError();
  }
  const tokenHash = hashDocumentShareToken(input.token);
  const rows = await env.tx
    .select({
      companyId: documentShareTokens.companyId,
      documentId: documentShareTokens.documentId,
      expiresAt: documentShareTokens.expiresAt,
      revokedAt: documentShareTokens.revokedAt,
      pdfDownloadUrl: documentShareTokens.pdfDownloadUrl,
      pdfDownloadExpiresAt: documentShareTokens.pdfDownloadExpiresAt,
    })
    .from(documentShareTokens)
    .where(eq(documentShareTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  const nowMs = Date.now();
  if (
    row === undefined ||
    row.revokedAt !== null ||
    row.expiresAt.getTime() <= nowMs
  ) {
    throw new NotFoundError();
  }
  return {
    companyId: row.companyId,
    resource: {
      documentId: row.documentId,
      pdfDownloadUrl: row.pdfDownloadUrl,
      pdfDownloadExpiresAt: row.pdfDownloadExpiresAt,
    },
  };
}

export const getShared = implementAction(getSharedContract, {
  resolveTarget: resolveSharedDocument,
  handler: async (_input, ctx) => {
    if (ctx.principal !== "public" || ctx.scope !== "target") {
      throw new CoreInvariantError("documents.getShared expects public-target");
    }
    const resource = ctx.target.resource;
    if (!isSharedTokenResource(resource)) {
      throw new CoreInvariantError(
        "documents.getShared resolver must return a share-token resource",
      );
    }
    const view = await loadStaffDocument({
      db: ctx.db,
      companyId: ctx.target.companyId,
      documentId: resource.documentId,
    });
    return {
      ...view,
      pdfDownloadUrl: storedSharePdfDownloadUrl(
        resource.pdfDownloadUrl,
        resource.pdfDownloadExpiresAt,
        new Date(),
      ),
    };
  },
});
