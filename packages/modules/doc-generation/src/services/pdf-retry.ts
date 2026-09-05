/**
 * PDF failure classification for SHO-436 / finding 3.
 *
 * Retry budget is the existing outbox delivery protocol (core.md §6):
 * five attempts, delays 1s / 2s / 4s / 8s after failures 1–4, then
 * dead-letter. This module does not run a second retry engine or hold
 * the action transaction open for a synchronous retry loop.
 *
 * Retryable: renderer, object-store PUT/Head, nested recordGeneratedObject,
 * and other unexpected throws — propagate so delivery does not ACK.
 * Terminal: snapshot/invariant failures that cannot recover on retry —
 * persist failed in the same transaction and return (ACK the delivery).
 *
 * Isolation class (unwrapped `NotFoundError` / `PermissionDeniedError`):
 * `documents.getForGeneration` uses the same not-found for missing and
 * foreign-company documents so existence is not leaked. Wrapping those
 * as `PdfGenerationRetryableError` (`CONFLICT`) would weaken isolation.
 * Delivery still retries the CoreError. After five attempts the worker
 * has no `readPdfRetryScope`, so `maybeFinalizeDeadPdfGeneration` logs
 * `replay-dead-deliveries` and does **not** persist failed. Deleted
 * documents CASCADE their jobs; foreign deliveries never write a job in
 * this tenant. `getArtifact` stays not-found (the panel maps that to
 * pending). That is this class, not a same-tenant `CONFLICT` mark.
 */
import { DELIVERY_MAX_ATTEMPTS, DELIVERY_RETRY_BASE_MS } from "@showzy/core";
import {
  ConflictError,
  CoreError,
  CoreInvariantError,
} from "@showzy/core/errors";

/** Same five-attempt cap the outbox executor uses for this consumer. */
export const PDF_TRANSIENT_RETRY_ATTEMPTS = DELIVERY_MAX_ATTEMPTS;

/** Base of the 1s × 2^(attempt-1) delivery backoff. */
export const PDF_TRANSIENT_RETRY_BASE_MS = DELIVERY_RETRY_BASE_MS;

const REDACTED_URL = /https?:\/\/\S+/gi;
const REDACTED_OBJECT_KEY = /[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}/gi;
const MAX_REASON_CHARS = 180;

export class PdfGenerationTerminalError extends CoreInvariantError {
  readonly pdfFailureClass = "terminal" as const;

  constructor(internalMessage: string, options?: { readonly cause?: unknown }) {
    super(internalMessage, options);
    this.name = "PdfGenerationTerminalError";
  }
}

export class PdfGenerationRetryableError extends ConflictError {
  readonly pdfFailureClass = "retryable" as const;
  readonly pdfDocumentId: string;
  readonly pdfCompanyId: string;

  constructor(env: {
    readonly documentId: string;
    readonly companyId: string;
    readonly reason: string;
  }) {
    super("PDF generation failed.", {
      internalMessage: `docGeneration.renderPdf retryable failure document_id=${env.documentId} reason=${env.reason}`,
    });
    this.name = "PdfGenerationRetryableError";
    this.pdfDocumentId = env.documentId;
    this.pdfCompanyId = env.companyId;
  }
}

export function sanitizePdfFailureReason(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown";
  const raw = error instanceof Error ? error.message : "non-error throw";
  const stripped = raw
    .replace(REDACTED_URL, "[redacted-url]")
    .replace(REDACTED_OBJECT_KEY, "[redacted-key]")
    .replaceAll("\n", " ")
    .trim();
  const clipped =
    stripped.length > MAX_REASON_CHARS
      ? `${stripped.slice(0, MAX_REASON_CHARS)}…`
      : stripped;
  return `${name}: ${clipped}`;
}

export function toPdfGenerationRetryableError(env: {
  readonly documentId: string;
  readonly companyId: string;
  readonly cause: unknown;
}): PdfGenerationRetryableError {
  if (env.cause instanceof PdfGenerationRetryableError) {
    return env.cause;
  }
  return new PdfGenerationRetryableError({
    documentId: env.documentId,
    companyId: env.companyId,
    reason: sanitizePdfFailureReason(env.cause),
  });
}

export function readPdfRetryScope(
  error: CoreError,
): { readonly documentId: string; readonly companyId: string } | undefined {
  if (!(error instanceof PdfGenerationRetryableError)) {
    return undefined;
  }
  return {
    documentId: error.pdfDocumentId,
    companyId: error.pdfCompanyId,
  };
}
