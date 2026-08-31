/**
 * Shared HITL signing-gate copy, TTL, and Zod-literal gates (SHO-286).
 * `documents.requestSign`, `documents.lockIssuedForSigning`, and
 * `docSigning.start` must emit the same clientMessage for the same failed
 * gate. Modules throw via `@showzy/module-kit/require` (this package is
 * client-safe and owns no ValidationError).
 */
import { z } from "zod";

export const CANCELLED_DOCUMENT_SIGN_MESSAGE =
  "Cancelled documents cannot be signed.";
export const CANCELLED_REQUEST_SIGN_MESSAGE = CANCELLED_DOCUMENT_SIGN_MESSAGE;
export const CANCELLED_START_MESSAGE = CANCELLED_DOCUMENT_SIGN_MESSAGE;

export const ALREADY_SIGNED_MESSAGE = "Document is already signed.";
export const PDF_NOT_READY_MESSAGE =
  "The document PDF must be ready before requesting a signature.";
export const GRANT_MISSING_MESSAGE =
  "A signature request grant is required. Call documents.requestSign again.";
export const GRANT_EXPIRED_MESSAGE =
  "The signature request grant has expired. Call documents.requestSign again.";

/** HITL grant TTL: 15 minutes. Same value for requestSign, lock, and start. */
export const SIGN_REQUEST_GRANT_TTL_MS = 15 * 60 * 1000;
export const SIGN_REQUEST_TTL_MS = SIGN_REQUEST_GRANT_TTL_MS;

export const readyPdfGate = z.object({
  present: z.literal(true, { error: PDF_NOT_READY_MESSAGE }),
});

export const grantPresentGate = z.object({
  present: z.literal(true, { error: GRANT_MISSING_MESSAGE }),
});

export const grantFreshGate = z.object({
  fresh: z.literal(true, { error: GRANT_EXPIRED_MESSAGE }),
});

export function isSignRequestGrantPresent(
  signRequestedAt: Date | string | null,
): boolean {
  return signRequestedAt !== null;
}

export function signRequestRequestedAtMs(
  signRequestedAt: Date | string | null,
): number {
  if (signRequestedAt === null) {
    return Number.NaN;
  }
  if (signRequestedAt instanceof Date) {
    return signRequestedAt.getTime();
  }
  return Date.parse(signRequestedAt);
}

export function isSignRequestGrantFresh(
  signRequestedAt: Date | string | null,
  nowMs: number = Date.now(),
): boolean {
  const requestedAtMs = signRequestRequestedAtMs(signRequestedAt);
  return (
    Number.isFinite(requestedAtMs) &&
    nowMs - requestedAtMs < SIGN_REQUEST_GRANT_TTL_MS
  );
}
