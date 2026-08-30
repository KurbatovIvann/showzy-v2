import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SIGN_REQUEST_TTL_MS,
  START_SIGNING_TIMEOUT_MS,
  startSigningContract,
  startSigningInputSchema,
  startSigningOutputSchema,
} from "./start.contract.js";

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
    expect(startSigningContract.timeout).toBeGreaterThan(
      15_000 + 5_000 + 5_000,
    );
    expect(SIGN_REQUEST_TTL_MS).toBe(15 * 60 * 1000);
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

  it("nests documents.get, lockIssuedForSigning, and issueDocumentDownloadUrl without foreign schema or complete", () => {
    expect(startSource).toContain("getDocument");
    expect(startSource).toContain("lockIssuedForSigning");
    expect(startSource).toContain('from "@showzy/documents"');
    expect(startSource).toContain("issueDocumentDownloadUrl");
    expect(startSource).toContain("existing.payloadFileId");
    expect(startSource).toContain('from "@showzy/files"');
    expect(startSource).toContain("ctx.call");
    expect(startSource).not.toContain("getArtifact");
    expect(startSource).not.toContain("docSigning.complete");
    expect(startSource).not.toContain("recordSigningObject");
    expect(startSource).not.toContain("documents.sign");
    expect(startSource).not.toContain("@showzy/db/schema/documents");
    expect(startSource).not.toContain("@showzy/db/schema/files");
    expect(startSource).not.toContain("@showzy/db/schema/doc-generation");
  });
});
