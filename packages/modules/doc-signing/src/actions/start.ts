import { implementAction, type AuditTargetEnv } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  ValidationError,
} from "@showzy/core/errors";
import { signingRequests } from "@showzy/db/schema/doc-signing";
import { getDocument } from "@showzy/documents";
import { issueDocumentDownloadUrl } from "@showzy/files";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { SIGN_REQUEST_TTL_MS, startSigningContract } from "./start.contract.js";
import { postgresUniqueConstraint } from "../services/postgres-unique.js";
import { requireStaffWritable } from "../services/writable.js";

export const CANCELLED_START_MESSAGE = "Cancelled documents cannot be signed.";
export const ALREADY_SIGNED_MESSAGE = "Document is already signed.";
export const PDF_NOT_READY_MESSAGE =
  "The document PDF must be ready before requesting a signature.";
export const GRANT_MISSING_MESSAGE =
  "A signature request grant is required. Call documents.requestSign again.";
export const GRANT_EXPIRED_MESSAGE =
  "The signature request grant has expired. Call documents.requestSign again.";

export const SIGNING_REQUESTS_DOCUMENT_PENDING_UQ =
  "signing_requests_document_id_pending_uq";

const documentIdHolder = z.object({ documentId: z.string() });

const grantPresentGate = z.object({
  present: z.literal(true, { error: GRANT_MISSING_MESSAGE }),
});

const grantFreshGate = z.object({
  fresh: z.literal(true, { error: GRANT_EXPIRED_MESSAGE }),
});

const readyPdfGate = z.object({
  present: z.literal(true, { error: PDF_NOT_READY_MESSAGE }),
});

function startAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const parsed = documentIdHolder.safeParse(env.input);
  return {
    type: "document",
    id: parsed.success ? parsed.data.documentId : "unknown",
  };
}

function requireUnexpiredGrant(signRequestedAt: string | null): void {
  const present = grantPresentGate.safeParse({
    present: signRequestedAt !== null,
  });
  if (!present.success) {
    throw new ValidationError(present.error.issues, GRANT_MISSING_MESSAGE);
  }
  const requestedAtMs = Date.parse(signRequestedAt ?? "");
  const fresh = grantFreshGate.safeParse({
    fresh:
      Number.isFinite(requestedAtMs) &&
      Date.now() - requestedAtMs < SIGN_REQUEST_TTL_MS,
  });
  if (!fresh.success) {
    throw new ValidationError(fresh.error.issues, GRANT_EXPIRED_MESSAGE);
  }
}

function requireReadyPdf(fileId: string | null): asserts fileId is string {
  const parsed = readyPdfGate.safeParse({ present: fileId !== null });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues, PDF_NOT_READY_MESSAGE);
  }
}

type PendingRequest = {
  readonly id: string;
  readonly payloadFileId: string;
  readonly payloadSha256: string;
};

async function loadPendingRequest(env: {
  readonly db: ReturnType<typeof requireStaffWritable>;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<PendingRequest | undefined> {
  const rows = await env.db
    .select({
      id: signingRequests.id,
      payloadFileId: signingRequests.payloadFileId,
      payloadSha256: signingRequests.payloadSha256,
    })
    .from(signingRequests)
    .where(
      and(
        eq(signingRequests.companyId, env.companyId),
        eq(signingRequests.documentId, env.documentId),
        eq(signingRequests.status, "pending"),
      ),
    )
    .limit(1);
  return rows[0];
}

export const startSigning = implementAction(startSigningContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("docSigning.start expects staff");
    }

    const document = await ctx.call(getDocument, {
      documentId: input.documentId,
    });
    if (document.status !== "issued") {
      throw new ConflictError(CANCELLED_START_MESSAGE);
    }
    requireUnexpiredGrant(document.signRequestedAt);
    if (document.signing.status === "supplier_signed") {
      throw new ConflictError(ALREADY_SIGNED_MESSAGE);
    }
    const payloadFileId =
      document.generation.status === "ready"
        ? document.generation.fileId
        : null;
    requireReadyPdf(payloadFileId);

    const issued = await ctx.call(issueDocumentDownloadUrl, {
      fileId: payloadFileId,
    });

    const db = requireStaffWritable(ctx.db);
    const existing = await loadPendingRequest({
      db,
      companyId: ctx.companyId,
      documentId: input.documentId,
    });
    if (existing !== undefined) {
      return {
        requestId: existing.id,
        documentId: input.documentId,
        payloadFileId: existing.payloadFileId,
        payloadSha256: existing.payloadSha256,
        payloadDigestAlgorithm: "sha256" as const,
        payloadDownloadUrl: issued.downloadUrl,
        payloadDownloadExpiresAt: issued.expiresAt,
      };
    }

    try {
      const inserted = await db
        .insert(signingRequests)
        .values({
          companyId: ctx.companyId,
          documentId: input.documentId,
          payloadFileId,
          payloadSha256: issued.checksumSha256,
          payloadDigestAlgorithm: "sha256",
          status: "pending",
        })
        .returning({
          id: signingRequests.id,
          payloadFileId: signingRequests.payloadFileId,
          payloadSha256: signingRequests.payloadSha256,
        });
      const row = inserted[0];
      if (row === undefined) {
        throw new CoreInvariantError("docSigning.start insert returned no row");
      }
      return {
        requestId: row.id,
        documentId: input.documentId,
        payloadFileId: row.payloadFileId,
        payloadSha256: row.payloadSha256,
        payloadDigestAlgorithm: "sha256" as const,
        payloadDownloadUrl: issued.downloadUrl,
        payloadDownloadExpiresAt: issued.expiresAt,
      };
    } catch (error) {
      if (
        postgresUniqueConstraint(error) !== SIGNING_REQUESTS_DOCUMENT_PENDING_UQ
      ) {
        throw error;
      }
      const raced = await loadPendingRequest({
        db,
        companyId: ctx.companyId,
        documentId: input.documentId,
      });
      if (raced === undefined) {
        throw new CoreInvariantError(
          "docSigning.start unique race lost a pending request",
        );
      }
      return {
        requestId: raced.id,
        documentId: input.documentId,
        payloadFileId: raced.payloadFileId,
        payloadSha256: raced.payloadSha256,
        payloadDigestAlgorithm: "sha256" as const,
        payloadDownloadUrl: issued.downloadUrl,
        payloadDownloadExpiresAt: issued.expiresAt,
      };
    }
  },
  auditTarget: startAuditTarget,
});
