import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  DIFFERENT_FILE_MESSAGE,
  completeSigningView,
  resolveExistingSignature,
  snapshotFromSignature,
  type SupplierSignatureRow,
} from "./resolve-existing-signature.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8211-222222222222";
const fileId = "33333333-3333-4333-8311-333333333333";
const otherFileId = "44444444-4444-4444-8411-444444444444";

const signature: SupplierSignatureRow = {
  fileId,
  signerCn: "CN",
  signerOrg: "Org",
  signerTaxId: "12345678",
  signatureAlg: "1.2.804.2.1.1.1.1.3.1.1",
  signedAt: new Date("2026-08-30T12:00:00.000Z"),
};

describe("resolveExistingSignature", () => {
  it("replays the same fileId with the recorded snapshot", () => {
    const resolved = resolveExistingSignature({
      signature,
      fileId,
      documentId,
      requestId,
    });
    expect(resolved.output).toEqual(
      completeSigningView({ documentId, requestId, signature }),
    );
    expect(resolved.snapshot).toEqual(
      snapshotFromSignature(documentId, signature),
    );
  });

  it("conflicts when the recorded fileId differs", () => {
    expect(() =>
      resolveExistingSignature({
        signature,
        fileId: otherFileId,
        documentId,
        requestId,
      }),
    ).toThrow(ConflictError);
    try {
      resolveExistingSignature({
        signature,
        fileId: otherFileId,
        documentId,
        requestId,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      if (error instanceof ConflictError) {
        expect(error.clientMessage).toBe(DIFFERENT_FILE_MESSAGE);
      }
    }
  });
});
