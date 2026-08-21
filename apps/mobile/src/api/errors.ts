/**
 * Contract.md §4 error union plus query-failure kinds screens map later.
 * Callers narrow on `error.code` / `kind` — never by matching `message` text.
 */
import { onlineManager } from "@tanstack/react-query";
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
  readonly summary?: string;
};

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
  readonly retryAfterSec?: number;
  readonly challengeId?: string;
  readonly summary?: string;
};

export function describeWireError(error: unknown): WireErrorView | null {
  if (!isWireError(error)) {
    return null;
  }
  return viewFor(error);
}

export function describeQueryFailure(
  error: unknown,
  options: { readonly online?: boolean } = {},
): QueryFailure {
  const view = describeWireError(error);
  if (view !== null) {
    return {
      kind: kindForWireCode(view.code),
      message: view.message,
      ...(view.retryAfterSec === undefined
        ? {}
        : { retryAfterSec: view.retryAfterSec }),
      ...(view.challengeId === undefined
        ? {}
        : { challengeId: view.challengeId }),
      ...(view.summary === undefined ? {} : { summary: view.summary }),
    };
  }
  const online = options.online ?? onlineManager.isOnline();
  return online
    ? { kind: "network", message: "network" }
    : { kind: "offline", message: "offline" };
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
        summary: error.data.challenge.summary,
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
