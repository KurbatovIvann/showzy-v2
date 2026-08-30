import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMPLETE_SIGNING_TIMEOUT_MS,
  completeSigningContract,
  completeSigningInputSchema,
  completeSigningOutputSchema,
} from "./complete.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const completeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "complete.ts"),
  "utf8",
);

describe("docSigning.complete contract", () => {
  it("is a staff client write with documents:edit, internal AI, protocol-idempotent, and audited", () => {
    expect(completeSigningContract.name).toBe("docSigning.complete");
    expect(completeSigningContract.principal).toBe("staff");
    expect(completeSigningContract.transport).toBe("client");
    expect(completeSigningContract.risk).toBe("write");
    expect(completeSigningContract.permissions).toEqual(["documents:edit"]);
    expect(completeSigningContract.aiExposure).toBe("internal");
    expect(completeSigningContract.requiresConfirmation).toBe(false);
    expect(completeSigningContract.idempotent).toBe(true);
    expect(completeSigningContract.audit).toBe(true);
    expect(completeSigningContract.emits).toEqual(["docSigning.recorded"]);
    expect(completeSigningContract.atomicCalls).toEqual([
      "files.recordSigningObject",
    ]);
    expect(completeSigningContract.atomicCallers).toEqual([]);
    expect(completeSigningContract.timeout).toBe(COMPLETE_SIGNING_TIMEOUT_MS);
    expect(completeSigningContract.timeout).toBe(30_000);
    expect(completeSigningContract.rateLimit).toBeUndefined();
    expect(Object.keys(completeSigningOutputSchema.shape).toSorted()).toEqual([
      "documentId",
      "fileId",
      "requestId",
      "signatureAlg",
      "signedAt",
      "signerCn",
      "signerOrg",
      "signerRole",
      "signerTaxId",
    ]);
  });

  it("accepts only requestId and fileId and rejects companyId, bytes, and base64", () => {
    expect(
      completeSigningInputSchema.parse({
        requestId: validId,
        fileId: validId,
      }),
    ).toEqual({ requestId: validId, fileId: validId });
    expect(completeSigningInputSchema.safeParse({}).success).toBe(false);
    expect(
      completeSigningInputSchema.safeParse({ requestId: validId }).success,
    ).toBe(false);
    expect(
      completeSigningInputSchema.safeParse({
        requestId: validId,
        fileId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      completeSigningInputSchema.safeParse({
        requestId: validId,
        fileId: validId,
        bytes: "YmFzZTY0",
      }).success,
    ).toBe(false);
    expect(
      completeSigningInputSchema.safeParse({
        requestId: validId,
        fileId: validId,
        asicBase64: "YmFzZTY0",
      }).success,
    ).toBe(false);
    expect(JSON.stringify(completeSigningInputSchema.shape)).not.toMatch(
      /base64/i,
    );
    expect(
      completeSigningOutputSchema.safeParse({
        documentId: validId,
        requestId: validId,
        fileId: validId,
        signerRole: "supplier",
        signerCn: "CN",
        signerOrg: "Org",
        signerTaxId: "12345678",
        signatureAlg: "1.2.804.2.1.1.1.1.3.1.1",
        signedAt: "2026-08-30T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("nests lock, pending staging read, and atomic record without foreign schema or finalize", () => {
    expect(completeSource).toContain("lockIssuedForSigning");
    expect(completeSource).toContain("readPendingSigningObject");
    expect(completeSource).toContain("recordSigningObject");
    expect(completeSource).toContain("ctx.callAtomic");
    expect(completeSource).toContain("verifyAsicE");
    expect(completeSource).toContain("docSigningRecorded");
    expect(completeSource).not.toContain("finalizeUpload");
    expect(completeSource).not.toContain("documents.sign");
    expect(completeSource).not.toContain("attachSignedShare");
    expect(completeSource).not.toContain("@showzy/db/schema/documents");
    expect(completeSource).not.toContain("@showzy/db/schema/files");
    expect(completeSource).not.toContain("payloadDownloadUrl");
  });
});
