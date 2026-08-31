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
  SIGN_REQUEST_TTL_MS,
  grantFreshGate,
  grantPresentGate,
  isSignRequestGrantFresh,
  isSignRequestGrantPresent,
  readyPdfGate,
} from "./signing.js";

describe("@showzy/validation/signing", () => {
  it("pins the same 15-minute grant TTL for request-sign and start", () => {
    expect(SIGN_REQUEST_GRANT_TTL_MS).toBe(15 * 60 * 1000);
    expect(SIGN_REQUEST_TTL_MS).toBe(SIGN_REQUEST_GRANT_TTL_MS);
  });

  it("pins the same user-facing clientMessage for each failed gate", () => {
    expect(CANCELLED_REQUEST_SIGN_MESSAGE).toBe(CANCELLED_START_MESSAGE);
    expect(CANCELLED_REQUEST_SIGN_MESSAGE).toBe(
      CANCELLED_DOCUMENT_SIGN_MESSAGE,
    );
    expect(CANCELLED_DOCUMENT_SIGN_MESSAGE).toBe(
      "Cancelled documents cannot be signed.",
    );
    expect(ALREADY_SIGNED_MESSAGE).toBe("Document is already signed.");
    expect(PDF_NOT_READY_MESSAGE).toBe(
      "The document PDF must be ready before requesting a signature.",
    );
    expect(GRANT_MISSING_MESSAGE).toBe(
      "A signature request grant is required. Call documents.requestSign again.",
    );
    expect(GRANT_EXPIRED_MESSAGE).toBe(
      "The signature request grant has expired. Call documents.requestSign again.",
    );
  });

  it("fails the Zod-literal gates with those clientMessages", () => {
    expect(readyPdfGate.safeParse({ present: true }).success).toBe(true);
    expect(readyPdfGate.safeParse({ present: false }).success).toBe(false);
    expect(grantPresentGate.safeParse({ present: false }).success).toBe(false);
    expect(grantFreshGate.safeParse({ fresh: false }).success).toBe(false);
    const pdf = readyPdfGate.safeParse({ present: false });
    expect(pdf.success).toBe(false);
    if (!pdf.success) {
      expect(pdf.error.issues[0]?.message).toBe(PDF_NOT_READY_MESSAGE);
    }
    const missing = grantPresentGate.safeParse({ present: false });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toBe(GRANT_MISSING_MESSAGE);
    }
    const expired = grantFreshGate.safeParse({ fresh: false });
    expect(expired.success).toBe(false);
    if (!expired.success) {
      expect(expired.error.issues[0]?.message).toBe(GRANT_EXPIRED_MESSAGE);
    }
  });

  it("treats Date and ISO grant timestamps as fresh inside the TTL", () => {
    const nowMs = Date.parse("2026-08-31T12:00:00.000Z");
    expect(isSignRequestGrantPresent(null)).toBe(false);
    expect(isSignRequestGrantFresh(null, nowMs)).toBe(false);

    const freshDate = new Date(nowMs - SIGN_REQUEST_GRANT_TTL_MS + 1_000);
    expect(isSignRequestGrantPresent(freshDate)).toBe(true);
    expect(isSignRequestGrantFresh(freshDate, nowMs)).toBe(true);
    expect(isSignRequestGrantFresh(freshDate.toISOString(), nowMs)).toBe(true);

    const expiredDate = new Date(nowMs - SIGN_REQUEST_GRANT_TTL_MS);
    expect(isSignRequestGrantFresh(expiredDate, nowMs)).toBe(false);
    expect(isSignRequestGrantFresh(expiredDate.toISOString(), nowMs)).toBe(
      false,
    );
  });
});
