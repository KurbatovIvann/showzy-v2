import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  cancelDocumentContract,
  cancelDocumentInputSchema,
} from "./cancel.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const cancelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "cancel.ts"),
  "utf8",
);

describe("documents.cancel contract", () => {
  it("is a staff client write with documents:edit, idempotent audit, and documents.cancelled", () => {
    expect(cancelDocumentContract.name).toBe("documents.cancel");
    expect(cancelDocumentContract.principal).toBe("staff");
    expect(cancelDocumentContract.transport).toBe("client");
    expect(cancelDocumentContract.risk).toBe("write");
    expect(cancelDocumentContract.permissions).toEqual(["documents:edit"]);
    expect(cancelDocumentContract.aiExposure).toBe("exposed");
    expect(cancelDocumentContract.audit).toBe(true);
    expect(cancelDocumentContract.idempotent).toBe(true);
    expect(cancelDocumentContract.requiresConfirmation).toBe(false);
    expect(cancelDocumentContract.emits).toEqual(["documents.cancelled"]);
    expect(cancelDocumentContract.atomicCalls).toEqual([]);
    expect(cancelDocumentContract.atomicCallers).toEqual([]);
    expect(cancelDocumentContract.timeout).toBe(5_000);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(cancelDocumentInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(cancelDocumentInputSchema.safeParse({}).success).toBe(false);
    expect(
      cancelDocumentInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      cancelDocumentInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });

  it("does not delete S3 objects, generation jobs, or rewind the counter", () => {
    expect(cancelSource).not.toContain("@showzy/files");
    expect(cancelSource).not.toContain("@showzy/db/schema/files");
    expect(cancelSource).not.toContain("@showzy/db/schema/doc-generation");
    expect(cancelSource).not.toContain("documentGenerationJobs");
    expect(cancelSource).not.toContain("document_generation_jobs");
    expect(cancelSource).not.toContain("documentNumberCounters");
    expect(cancelSource).not.toContain("lastNumber");
    expect(cancelSource).not.toContain("last_number");
    expect(cancelSource).toContain('.for("update")');
  });
});
