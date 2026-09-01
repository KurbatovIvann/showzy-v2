/**
 * Contract.md §4 error union plus query-failure kinds screens map later.
 * Callers narrow on `error.code` / `kind` — never by matching `message` text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

export type QueryFailureKind =
  | "validation"
  | "unauthenticated"
  | "permission"
  | "not_found"
  | "conflict"
  | "confirmation"
  | "rate_limited"
  | "timeout"
  | "internal"
  | "network"
  | "offline";

export type QueryFailure = {
  readonly kind: QueryFailureKind;
  readonly message: string;
};

export function describeWireCode(error: unknown): WireErrorCode | null {
  return isWireError(error) ? error.code : null;
}

export function describeQueryFailure(error: unknown): QueryFailure {
  const code = describeWireCode(error);
  if (code !== null) {
    return { kind: kindForWireCode(code), message: "wire" };
  }
  return { kind: "network", message: "network" };
}

function kindForWireCode(code: WireErrorCode): QueryFailureKind {
  switch (code) {
    case "VALIDATION":
      return "validation";
    case "UNAUTHENTICATED":
      return "unauthenticated";
    case "PERMISSION_DENIED":
      return "permission";
    case "NOT_FOUND":
      return "not_found";
    case "CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
    case "RETRY_IN_PROGRESS":
      return "conflict";
    case "CONFIRMATION_REQUIRED":
      return "confirmation";
    case "RATE_LIMITED":
      return "rate_limited";
    case "TIMEOUT":
      return "timeout";
    case "INTERNAL":
      return "internal";
  }
}
