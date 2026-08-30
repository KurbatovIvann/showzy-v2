import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES } from "../wire.contract.js";
import {
  readPendingSigningObjectContract,
  readPendingSigningObjectInputSchema,
  readPendingSigningObjectOutputSchema,
} from "./read-pending-signing-object.contract.js";

const validId = "22222222-2222-4222-8222-222222222222";

describe("files.readPendingSigningObject contract", () => {
  it("is a staff internal documents:edit read, unaudited, and off the client router", () => {
    expect(readPendingSigningObjectContract.name).toBe(
      "files.readPendingSigningObject",
    );
    expect(readPendingSigningObjectContract.principal).toBe("staff");
    expect(readPendingSigningObjectContract.transport).toBe("internal");
    expect(readPendingSigningObjectContract.risk).toBe("read");
    expect(readPendingSigningObjectContract.permissions).toEqual([
      "documents:edit",
    ]);
    expect(readPendingSigningObjectContract.aiExposure).toBe("internal");
    expect(readPendingSigningObjectContract.audit).toBe(false);
    expect(readPendingSigningObjectContract.idempotent).toBe(false);
    expect(readPendingSigningObjectContract.emits).toEqual([]);
    expect(readPendingSigningObjectContract.atomicCalls).toEqual([]);
    expect(readPendingSigningObjectContract.atomicCallers).toEqual([]);
    expect(readPendingSigningObjectContract.timeout).toBe(15_000);
    expect(MAX_DOCUMENT_BYTES).toBe(25 * 1024 * 1024);
  });

  it("accepts only fileId and never a company id, key, URL, or base64 body", () => {
    expect(
      Object.keys(readPendingSigningObjectInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(readPendingSigningObjectOutputSchema.shape).toSorted(),
    ).toEqual(["byteSize", "bytes", "checksumSha256", "fileId", "mimeType"]);
    expect(
      readPendingSigningObjectInputSchema.parse({ fileId: validId }),
    ).toEqual({ fileId: validId });
    expect(
      readPendingSigningObjectInputSchema.safeParse({
        fileId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      readPendingSigningObjectInputSchema.safeParse({
        fileId: validId,
        bytes: "YmFzZTY0",
      }).success,
    ).toBe(false);
    expect(readPendingSigningObjectContract.description).toContain("/uploads/");
    expect(readPendingSigningObjectContract.description).toContain(
      "docSigning.complete",
    );
    expect(readPendingSigningObjectContract.description).toContain(
      "Company id",
    );
  });
});
