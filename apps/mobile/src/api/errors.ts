/**
 * Example of handling the contract.md §4 error union. Callers narrow on
 * `error.code` — never by matching `message` text.
 */
import {
  isWireError,
  type WireError,
  type WireErrorCode,
} from "@showzy/contract";

export type WireErrorView = {
  readonly code: WireErrorCode;
  readonly message: string;
  readonly retryAfterSec?: number;
  readonly challengeId?: string;
};

export function describeWireError(error: unknown): WireErrorView | null {
  if (!isWireError(error)) {
    return null;
  }
  return viewFor(error);
}

function viewFor(error: WireError): WireErrorView {
  switch (error.code) {
    case "RATE_LIMITED":
    case "RETRY_IN_PROGRESS":
      return {
        code: error.code,
        message: error.message,
        retryAfterSec: error.data.retryAfterSec,
      };
    case "CONFIRMATION_REQUIRED":
      return {
        code: error.code,
        message: error.message,
        challengeId: error.data.challenge.challengeId,
      };
    case "VALIDATION":
    case "UNAUTHENTICATED":
    case "PERMISSION_DENIED":
    case "NOT_FOUND":
    case "CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
    case "TIMEOUT":
    case "INTERNAL":
      return { code: error.code, message: error.message };
  }
}
