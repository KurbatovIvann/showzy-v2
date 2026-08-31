import { implementAction } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { documents } from "@showzy/db/schema/documents";
import { getArtifact } from "@showzy/doc-generation/get-artifact";
import { requireOrValidationError } from "@showzy/module-kit/require";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  SIGN_REQUEST_GRANT_TTL_MS,
  lockIssuedForSigningContract,
} from "./lock-issued-for-signing.contract.js";
import {
  CANCELLED_REQUEST_SIGN_MESSAGE,
  PDF_NOT_READY_MESSAGE,
} from "./request-sign.js";
import {
  loadGenerationArtifact,
  readyArtifactFileId,
} from "../services/load-generation.js";

export const GRANT_MISSING_MESSAGE =
  "A signature request grant is required. Call documents.requestSign again.";
export const GRANT_EXPIRED_MESSAGE =
  "The signature request grant has expired. Call documents.requestSign again.";

const grantPresentGate = z.object({
  present: z.literal(true, { error: GRANT_MISSING_MESSAGE }),
});

const grantFreshGate = z.object({
  fresh: z.literal(true, { error: GRANT_EXPIRED_MESSAGE }),
});

const readyPdfGate = z.object({
  present: z.literal(true, { error: PDF_NOT_READY_MESSAGE }),
});

function requireUnexpiredGrant(signRequestedAt: Date | null): void {
  requireOrValidationError(
    grantPresentGate,
    { present: signRequestedAt !== null },
    GRANT_MISSING_MESSAGE,
  );
  const requestedAtMs = signRequestedAt?.getTime() ?? Number.NaN;
  requireOrValidationError(
    grantFreshGate,
    {
      fresh:
        Number.isFinite(requestedAtMs) &&
        Date.now() - requestedAtMs < SIGN_REQUEST_GRANT_TTL_MS,
    },
    GRANT_EXPIRED_MESSAGE,
  );
}

function requireReadyPdf(fileId: string | null): void {
  requireOrValidationError(
    readyPdfGate,
    { present: fileId !== null },
    PDF_NOT_READY_MESSAGE,
  );
}

export const lockIssuedForSigning = implementAction(
  lockIssuedForSigningContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "documents.lockIssuedForSigning expects staff",
        );
      }

      // Header lock copies `documents.requestSign` / `documents.cancel`.
      const rows = await ctx.db
        .select({
          status: documents.status,
          signRequestedAt: documents.signRequestedAt,
        })
        .from(documents)
        .where(
          and(
            eq(documents.companyId, ctx.companyId),
            eq(documents.id, input.documentId),
          ),
        )
        .limit(1)
        .for("update");
      const row = rows[0];
      if (row === undefined) {
        throw new NotFoundError();
      }
      if (row.status !== "issued") {
        throw new ConflictError(CANCELLED_REQUEST_SIGN_MESSAGE);
      }
      requireUnexpiredGrant(row.signRequestedAt);

      const generation = await loadGenerationArtifact({
        documentId: input.documentId,
        getArtifact: (body) => ctx.call(getArtifact, body),
      });
      requireReadyPdf(readyArtifactFileId(generation));

      return { documentId: input.documentId };
    },
  },
);
