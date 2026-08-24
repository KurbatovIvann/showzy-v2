import { ABANDONED_PENDING_TTL_MS } from "../actions/sweep-abandoned-uploads.contract.js";
import { SIGNED_URL_TTL_SEC } from "./s3-port.js";

/**
 * Clock-skew buffer so a minted PUT cannot survive the pending row.
 * Mechanical: 30s is enough for worker/API clock drift without shrinking
 * the remint window the card named (~45 minutes).
 */
export const SIGNED_PUT_SKEW_MARGIN_MS = 30_000;

export function pendingAbandonAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ABANDONED_PENDING_TTL_MS);
}

export function abandonedPendingCutoff(now: Date): Date {
  return new Date(now.getTime() - ABANDONED_PENDING_TTL_MS);
}

export function signedPutWouldOutlivePending(input: {
  readonly createdAt: Date;
  readonly now: Date;
}): boolean {
  const putExpiresAt =
    input.now.getTime() + SIGNED_URL_TTL_SEC * 1000 + SIGNED_PUT_SKEW_MARGIN_MS;
  return putExpiresAt >= pendingAbandonAt(input.createdAt).getTime();
}
