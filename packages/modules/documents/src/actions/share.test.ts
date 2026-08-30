import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PAGE_TOKEN_TTL_MS,
  documentShareUrl,
  shareDocumentContract,
  shareDocumentInputSchema,
} from "./share.contract.js";

const shareSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "share.ts"),
  "utf8",
);

const validId = "11111111-1111-4111-8111-111111111111";

describe("documents.share contract", () => {
  it("is a staff client write with documents:edit, idempotent audit, and no events", () => {
    expect(shareDocumentContract.name).toBe("documents.share");
    expect(shareDocumentContract.principal).toBe("staff");
    expect(shareDocumentContract.transport).toBe("client");
    expect(shareDocumentContract.risk).toBe("write");
    expect(shareDocumentContract.permissions).toEqual(["documents:edit"]);
    expect(shareDocumentContract.aiExposure).toBe("exposed");
    expect(shareDocumentContract.audit).toBe(true);
    expect(shareDocumentContract.idempotent).toBe(true);
    expect(shareDocumentContract.requiresConfirmation).toBe(false);
    expect(shareDocumentContract.emits).toEqual([]);
    expect(shareDocumentContract.atomicCalls).toEqual([]);
    expect(shareDocumentContract.atomicCallers).toEqual([]);
    expect(shareDocumentContract.timeout).toBe(10_000);
    expect(shareDocumentContract.rateLimit).toBeUndefined();
    expect(PAGE_TOKEN_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(shareDocumentInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(shareDocumentInputSchema.safeParse({}).success).toBe(false);
    expect(
      shareDocumentInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      shareDocumentInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });

  it("builds the public /d/{token} URL from the origin", () => {
    expect(documentShareUrl("abc", "https://showzy.test/")).toBe(
      "https://showzy.test/d/abc",
    );
  });

  it("nests getArtifact then files.issueShareDownloadUrl and does not import testing", () => {
    expect(shareSource).toContain("getArtifact");
    expect(shareSource).toContain("issueShareDownloadUrl");
    expect(shareSource).toContain("getSigning");
    expect(shareSource).toContain("issueShareSigningDownloadUrl");
    expect(shareSource).not.toContain("ready-share-file");
    expect(shareSource).not.toContain("@showzy/db/schema/doc-generation");
    expect(shareSource).not.toContain("@showzy/db/schema/doc-signing");
    expect(shareSource).not.toContain("@showzy/core/testing");
    expect(shareSource).not.toContain("issueGeneratedDownloadUrl");
    expect(shareSource).not.toContain("issueSystemSigningDownloadUrl");
  });
});
