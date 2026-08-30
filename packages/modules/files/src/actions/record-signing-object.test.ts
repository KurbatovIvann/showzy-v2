import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES } from "../wire.contract.js";
import {
  recordSigningObjectContract,
  recordSigningObjectInputSchema,
  recordSigningObjectOutputSchema,
} from "./record-signing-object.contract.js";

describe("files.recordSigningObject contract", () => {
  it("is a staff internal write, audited, idempotent, and the complete atomic callee", () => {
    expect(recordSigningObjectContract.name).toBe("files.recordSigningObject");
    expect(recordSigningObjectContract.principal).toBe("staff");
    expect(recordSigningObjectContract.transport).toBe("internal");
    expect(recordSigningObjectContract.risk).toBe("write");
    expect(recordSigningObjectContract.permissions).toEqual(["documents:edit"]);
    expect(recordSigningObjectContract.aiExposure).toBe("internal");
    expect(recordSigningObjectContract.audit).toBe(true);
    expect(recordSigningObjectContract.idempotent).toBe(true);
    expect(recordSigningObjectContract.emits).toEqual([]);
    expect(recordSigningObjectContract.atomicCalls).toEqual([]);
    expect(recordSigningObjectContract.atomicCallers).toEqual([
      "docSigning.complete",
    ]);
    expect(recordSigningObjectContract.timeout).toBe(15_000);
    expect(MAX_DOCUMENT_BYTES).toBe(25 * 1024 * 1024);
  });

  it("accepts only a signing ASiC selector and never a company id, key, or URL", () => {
    expect(
      Object.keys(recordSigningObjectInputSchema.shape).toSorted(),
    ).toEqual(["byteSize", "checksumSha256", "fileId", "mimeType", "purpose"]);
    expect(
      Object.keys(recordSigningObjectOutputSchema.shape).toSorted(),
    ).toEqual([
      "byteSize",
      "checksumSha256",
      "fileId",
      "mimeType",
      "purpose",
      "status",
    ]);
    expect(
      recordSigningObjectInputSchema.safeParse({
        fileId: "22222222-2222-4222-8222-222222222222",
        purpose: "document",
        mimeType: "application/vnd.etsi.asic-e+zip",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      recordSigningObjectInputSchema.safeParse({
        fileId: "22222222-2222-4222-8222-222222222222",
        purpose: "signing",
        mimeType: "application/pdf",
        byteSize: 12,
        checksumSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(recordSigningObjectContract.description).toContain("/signing/");
    expect(recordSigningObjectContract.description).toContain("company id");
    expect(recordSigningObjectContract.description).toContain(
      "docSigning.complete",
    );
    expect(recordSigningObjectContract.description).toContain(
      "staging object is already gone",
    );
  });
});
