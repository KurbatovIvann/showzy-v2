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

export function toAuthClientError(error: unknown): AuthClientError {
  if (error instanceof AuthClientError) {
    return error;
  }
  return new AuthClientError("network");
}

export function parseRetryAfterSec(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (raw === null || raw === "") {
    return undefined;
  }
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return undefined;
  }
  return seconds;
}
