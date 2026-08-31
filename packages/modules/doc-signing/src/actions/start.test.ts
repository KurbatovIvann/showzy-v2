import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ALREADY_SIGNED_MESSAGE,
  CANCELLED_DOCUMENT_SIGN_MESSAGE,
  CANCELLED_REQUEST_SIGN_MESSAGE,
  CANCELLED_START_MESSAGE,
  GRANT_EXPIRED_MESSAGE,
  GRANT_MISSING_MESSAGE,
  PDF_NOT_READY_MESSAGE,
  SIGN_REQUEST_GRANT_TTL_MS,
} from "@showzy/validation/signing";

import {
  SIGN_REQUEST_TTL_MS,
  START_SIGNING_TIMEOUT_MS,
  startSigningContract,
  startSigningInputSchema,
  startSigningOutputSchema,
} from "./start.contract.js";
import {
  ALREADY_SIGNED_MESSAGE as START_ALREADY_SIGNED_MESSAGE,
  CANCELLED_START_MESSAGE as START_CANCELLED_MESSAGE,
  GRANT_EXPIRED_MESSAGE as START_GRANT_EXPIRED_MESSAGE,
  GRANT_MISSING_MESSAGE as START_GRANT_MISSING_MESSAGE,
  PDF_NOT_READY_MESSAGE as START_PDF_NOT_READY_MESSAGE,
} from "./start.js";

const validId = "11111111-1111-4111-8111-111111111111";
const validSha = "a".repeat(64);

const startSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "start.ts"),
  "utf8",
);

describe("docSigning.start contract", () => {
  it("is a staff client write with documents:edit, internal AI, non-protocol-idempotent, and audited", () => {
    expect(startSigningContract.name).toBe("docSigning.start");
    expect(startSigningContract.principal).toBe("staff");
    expect(startSigningContract.transport).toBe("client");
    expect(startSigningContract.risk).toBe("write");
    expect(startSigningContract.permissions).toEqual(["documents:edit"]);
    expect(startSigningContract.aiExposure).toBe("internal");
    expect(startSigningContract.requiresConfirmation).toBe(false);
    expect(startSigningContract.idempotent).toBe(false);
    expect(startSigningContract.audit).toBe(true);
    expect(startSigningContract.emits).toEqual([]);
    expect(startSigningContract.atomicCalls).toEqual([]);
    expect(startSigningContract.atomicCallers).toEqual([]);
    expect(startSigningContract.timeout).toBe(START_SIGNING_TIMEOUT_MS);
    expect(startSigningContract.timeout).toBe(30_000);
    expect(startSigningContract.timeout).toBeGreaterThan(5_000 + 2_000 + 5_000);
    expect(SIGN_REQUEST_TTL_MS).toBe(15 * 60 * 1000);
    expect(SIGN_REQUEST_TTL_MS).toBe(SIGN_REQUEST_GRANT_TTL_MS);
    expect(startSigningContract.rateLimit).toBeUndefined();
    expect(Object.keys(startSigningOutputSchema.shape).toSorted()).toEqual([
      "documentId",
      "payloadDigestAlgorithm",
      "payloadDownloadExpiresAt",
      "payloadDownloadUrl",
      "payloadFileId",
      "payloadSha256",
      "requestId",
    ]);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(startSigningInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(startSigningInputSchema.safeParse({}).success).toBe(false);
    expect(
      startSigningInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      startSigningInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      startSigningOutputSchema.safeParse({
        requestId: validId,
        documentId: validId,
        payloadFileId: validId,
        payloadSha256: validSha,
        payloadDigestAlgorithm: "sha256",
        payloadDownloadUrl: "https://files.example/doc.pdf",
        payloadDownloadExpiresAt: "2026-08-30T12:15:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      startSigningOutputSchema.safeParse({
        requestId: validId,
        documentId: validId,
        payloadFileId: validId,
        payloadSha256: "A".repeat(64),
        payloadDigestAlgorithm: "sha256",
        payloadDownloadUrl: "https://files.example/doc.pdf",
        payloadDownloadExpiresAt: "2026-08-30T12:15:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("emits the same signing-gate clientMessages as documents.requestSign", () => {
    expect(START_CANCELLED_MESSAGE).toBe(CANCELLED_START_MESSAGE);
    expect(START_CANCELLED_MESSAGE).toBe(CANCELLED_REQUEST_SIGN_MESSAGE);
    expect(START_CANCELLED_MESSAGE).toBe(CANCELLED_DOCUMENT_SIGN_MESSAGE);
    expect(START_ALREADY_SIGNED_MESSAGE).toBe(ALREADY_SIGNED_MESSAGE);
    expect(START_PDF_NOT_READY_MESSAGE).toBe(PDF_NOT_READY_MESSAGE);
    expect(START_GRANT_MISSING_MESSAGE).toBe(GRANT_MISSING_MESSAGE);
    expect(START_GRANT_EXPIRED_MESSAGE).toBe(GRANT_EXPIRED_MESSAGE);
  });

  it("nests lockIssuedForSigning then getArtifact and issueDocumentDownloadUrl without documents.get", () => {
    expect(startSource).toContain("lockIssuedForSigning");
    expect(startSource).toContain('from "@showzy/documents"');
    expect(startSource).toContain("getArtifact");
    expect(startSource).toContain("@showzy/doc-generation/get-artifact");
    expect(startSource).toContain("issueDocumentDownloadUrl");
    expect(startSource).toContain("existing.payloadFileId");
    expect(startSource).toContain('from "@showzy/files"');
    expect(startSource).toContain("ctx.call");
    expect(startSource).not.toContain("getDocument");
    expect(startSource).not.toContain("getForGeneration");
    expect(startSource).not.toContain("docSigning.complete");
    expect(startSource).not.toContain("recordSigningObject");
    expect(startSource).not.toContain("documents.sign");
    expect(startSource).not.toContain("@showzy/db/schema/documents");
    expect(startSource).not.toContain("@showzy/db/schema/files");
    expect(startSource).not.toContain("@showzy/db/schema/doc-generation");
  });
});
