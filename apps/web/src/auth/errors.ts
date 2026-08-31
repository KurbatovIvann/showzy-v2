/**
 * Auth HTTP errors are classified by status, never by matching `message`
 * text (same rule as contract.md §4 wire errors). Server copy is discarded
 * so OTP codes and enumeration hints cannot leak into UI or logs.
 */

export type AuthErrorKind =
  | "invalid_identifier"
  | "invalid_otp"
  | "resend_limited"
  | "verify_locked"
  | "unauthenticated"
  | "unavailable"
  | "network";

export type AuthHttpOperation = "send" | "verify" | "session";

export class AuthClientError extends Error {
  readonly kind: AuthErrorKind;
  readonly retryAfterSec?: number;

  constructor(kind: AuthErrorKind, retryAfterSec?: number) {
    super(kind);
    this.name = "AuthClientError";
    this.kind = kind;
    if (retryAfterSec !== undefined) {
      this.retryAfterSec = retryAfterSec;
    }
  }
}

export function isAuthClientError(error: unknown): error is AuthClientError {
  return error instanceof AuthClientError;
}

export function classifyAuthHttpStatus(
  status: number,
  operation: AuthHttpOperation,
): AuthErrorKind {
  if (status === 429) {
    return "resend_limited";
  }
  if (status === 401) {
    return "unauthenticated";
  }
  if (operation === "verify" && status === 400) {
    return "invalid_otp";
  }
  if (operation === "verify" && status === 403) {
    return "verify_locked";
  }
  if (operation === "send" && status === 400) {
    return "invalid_identifier";
  }
  return "unavailable";
}

/**
 * Map a better-auth client error by HTTP status only. Never copy
 * `error.message` — it can contain OTP codes or enumeration hints.
 */
export function authErrorFromUnknown(
  error: unknown,
  operation: AuthHttpOperation,
): AuthClientError {
  if (error instanceof AuthClientError) {
    return error;
  }
  const status = statusFromUnknown(error);
  if (status === undefined) {
    return new AuthClientError("network");
  }
  return new AuthClientError(classifyAuthHttpStatus(status, operation));
}

export function statusFromUnknown(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if (!("status" in error)) {
    return undefined;
  }
  const status = error.status;
  if (typeof status !== "number" || !Number.isInteger(status) || status < 1) {
    return undefined;
  }
  return status;
}
