import { ConflictError } from "@showzy/core/errors";
import { signingSignatures } from "@showzy/db/schema/doc-signing";
import { ALREADY_SIGNED_MESSAGE } from "@showzy/validation/signing";
import { and, eq } from "drizzle-orm";

import { requireStaffWritable } from "./writable.js";

export const DIFFERENT_FILE_MESSAGE = ALREADY_SIGNED_MESSAGE;

export type SupplierSignatureRow = {
  readonly fileId: string;
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
  readonly signedAt: Date;
};

export type CompleteSigningView = {
  readonly documentId: string;
  readonly requestId: string;
  readonly fileId: string;
  readonly signerRole: "supplier";
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
  readonly signedAt: string;
};

export type CertSnapshot = {
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
  readonly documentId: string;
  readonly fileId: string;
  readonly signerRole: "supplier";
};

export async function loadSupplierSignature(env: {
  readonly db: ReturnType<typeof requireStaffWritable>;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<SupplierSignatureRow | undefined> {
  const rows = await env.db
    .select({
      fileId: signingSignatures.fileId,
      signerCn: signingSignatures.signerCn,
      signerOrg: signingSignatures.signerOrg,
      signerTaxId: signingSignatures.signerTaxId,
      signatureAlg: signingSignatures.signatureAlg,
      signedAt: signingSignatures.signedAt,
    })
    .from(signingSignatures)
    .where(
      and(
        eq(signingSignatures.companyId, env.companyId),
        eq(signingSignatures.documentId, env.documentId),
        eq(signingSignatures.signerRole, "supplier"),
      ),
    )
    .limit(1);
  return rows[0];
}

export function completeSigningView(env: {
  readonly documentId: string;
  readonly requestId: string;
  readonly signature: SupplierSignatureRow;
}): CompleteSigningView {
  return {
    documentId: env.documentId,
    requestId: env.requestId,
    fileId: env.signature.fileId,
    signerRole: "supplier",
    signerCn: env.signature.signerCn,
    signerOrg: env.signature.signerOrg,
    signerTaxId: env.signature.signerTaxId,
    signatureAlg: env.signature.signatureAlg,
    signedAt: env.signature.signedAt.toISOString(),
  };
}

export function snapshotFromSignature(
  documentId: string,
  signature: SupplierSignatureRow,
): CertSnapshot {
  return {
    signerCn: signature.signerCn,
    signerOrg: signature.signerOrg,
    signerTaxId: signature.signerTaxId,
    signatureAlg: signature.signatureAlg,
    documentId,
    fileId: signature.fileId,
    signerRole: "supplier",
  };
}

/**
 * Same-file replay vs different-file conflict for an already-recorded
 * supplier signature (the four-site ladder in `docSigning.complete`).
 */
export function resolveExistingSignature(env: {
  readonly signature: SupplierSignatureRow;
  readonly fileId: string;
  readonly documentId: string;
  readonly requestId: string;
}): {
  readonly output: CompleteSigningView;
  readonly snapshot: CertSnapshot;
} {
  if (env.signature.fileId !== env.fileId) {
    throw new ConflictError(DIFFERENT_FILE_MESSAGE);
  }
  return {
    output: completeSigningView({
      documentId: env.documentId,
      requestId: env.requestId,
      signature: env.signature,
    }),
    snapshot: snapshotFromSignature(env.documentId, env.signature),
  };
}
