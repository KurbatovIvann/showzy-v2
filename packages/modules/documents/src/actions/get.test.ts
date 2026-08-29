import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  getDocumentContract,
  getDocumentInputSchema,
  getDocumentOutputSchema,
} from "./get.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const getSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "get.ts"),
  "utf8",
);
const loadSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../services/load-document.ts"),
  "utf8",
);

describe("documents.get contract", () => {
  it("is a staff client read with documents:view and no audit", () => {
    expect(getDocumentContract.name).toBe("documents.get");
    expect(getDocumentContract.principal).toBe("staff");
    expect(getDocumentContract.transport).toBe("client");
    expect(getDocumentContract.risk).toBe("read");
    expect(getDocumentContract.permissions).toEqual(["documents:view"]);
    expect(getDocumentContract.aiExposure).toBe("exposed");
    expect(getDocumentContract.audit).toBe(false);
    expect(getDocumentContract.idempotent).toBe(false);
    expect(getDocumentContract.emits).toEqual([]);
    expect(getDocumentContract.atomicCalls).toEqual([]);
    expect(getDocumentContract.atomicCallers).toEqual([]);
    expect(getDocumentContract.timeout).toBe(2_000);
    expect(getDocumentContract.rateLimit).toBeUndefined();
    expect(Object.keys(getDocumentOutputSchema.shape).toSorted()).toEqual([
      "buyerDetails",
      "counterpartyId",
      "createdAt",
      "currency",
      "documentId",
      "documentNumber",
      "generation",
      "issuedOn",
      "items",
      "orderId",
      "pdfDownloadUrl",
      "status",
      "supplierDetails",
      "templateName",
      "templateSource",
      "totalGrossMinor",
      "totalNetMinor",
      "totalTaxMinor",
      "type",
    ]);
  });

  it("accepts documentId and rejects companyId and extra identifiers", () => {
    expect(getDocumentInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(getDocumentInputSchema.safeParse({}).success).toBe(false);
    expect(
      getDocumentInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: validId },
      { orderId: validId },
      { fileId: validId },
    ]) {
      expect(
        getDocumentInputSchema.safeParse({ documentId: validId, ...extra })
          .success,
      ).toBe(false);
    }
  });

  it("does not query generation jobs or files tables", () => {
    const sources = `${getSource}\n${loadSource}`;
    expect(sources).not.toContain("documentGenerationJobs");
    expect(sources).not.toContain("document_generation_jobs");
    expect(sources).not.toContain("issueDocumentDownloadUrl");
    expect(sources).not.toContain("@showzy/files");
    expect(sources).not.toContain("@showzy/db/schema/files");
    expect(sources).not.toContain("@showzy/db/schema/doc-generation");
    expect(getSource).toContain("generation: null");
    expect(getSource).toContain("pdfDownloadUrl: null");
  });
});
