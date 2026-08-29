import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES } from "../wire.contract.js";
import {
  recordGeneratedObjectContract,
  recordGeneratedObjectInputSchema,
  recordGeneratedObjectOutputSchema,
} from "./record-generated-object.contract.js";

describe("files.recordGeneratedObject contract", () => {
  it("is a tenant system write, internal, audited, and idempotent", () => {
    expect(recordGeneratedObjectContract.name).toBe(
      "files.recordGeneratedObject",
    );
    expect(recordGeneratedObjectContract.principal).toBe("system");
    expect(recordGeneratedObjectContract.systemScope).toBe("tenant");
    expect(recordGeneratedObjectContract.transport).toBe("internal");
    expect(recordGeneratedObjectContract.risk).toBe("write");
    expect(recordGeneratedObjectContract.permissions).toEqual([]);
    expect(recordGeneratedObjectContract.aiExposure).toBe("internal");
    expect(recordGeneratedObjectContract.audit).toBe(true);
    expect(recordGeneratedObjectContract.idempotent).toBe(true);
    expect(recordGeneratedObjectContract.emits).toEqual([]);
    expect(recordGeneratedObjectContract.atomicCalls).toEqual([]);
    expect(recordGeneratedObjectContract.atomicCallers).toEqual([
      "docGeneration.renderPdf",
    ]);
    expect(recordGeneratedObjectContract.timeout).toBe(15_000);
    expect(MAX_DOCUMENT_BYTES).toBe(25 * 1024 * 1024);
  });

  it("accepts only a document PDF selector and never a company id, key, or URL", () => {
    expect(
      Object.keys(recordGeneratedObjectInputSchema.shape).toSorted(),
    ).toEqual(["byteSize", "checksumSha256", "fileId", "mimeType", "purpose"]);
    expect(
      Object.keys(recordGeneratedObjectOutputSchema.shape).toSorted(),
    ).toEqual([
      "byteSize",
      "checksumSha256",
      "fileId",
      "mimeType",
      "purpose",
      "status",
    ]);
    expect(
      recordGeneratedObjectInputSchema.safeParse({
        fileId: "22222222-2222-4222-8222-222222222222",
        purpose: "catalog",
        mimeType: "application/pdf",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      recordGeneratedObjectInputSchema.safeParse({
        fileId: "22222222-2222-4222-8222-222222222222",
        purpose: "document",
        mimeType: "image/jpeg",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(recordGeneratedObjectContract.description).toContain("/documents/");
    expect(recordGeneratedObjectContract.description).toContain("company id");
  });
});
