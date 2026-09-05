import { describe, expect, it } from "vitest";

import { ConflictError, CoreInvariantError } from "@showzy/core/errors";

import {
  PDF_TRANSIENT_RETRY_ATTEMPTS,
  PDF_TRANSIENT_RETRY_BASE_MS,
  PdfGenerationRetryableError,
  PdfGenerationTerminalError,
  readPdfRetryScope,
  sanitizePdfFailureReason,
  toPdfGenerationRetryableError,
} from "./pdf-retry.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

describe("pdf failure classification (SHO-436)", () => {
  it("pins the existing outbox retry budget", () => {
    expect(PDF_TRANSIENT_RETRY_ATTEMPTS).toBe(5);
    expect(PDF_TRANSIENT_RETRY_BASE_MS).toBe(1_000);
  });

  it("redacts URLs and object keys from failure reasons", () => {
    const reason = sanitizePdfFailureReason(
      new Error(
        "put failed https://garage.example/bucket?X-Amz-Signature=abc 11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222",
      ),
    );
    expect(reason).toContain("Error:");
    expect(reason).not.toContain("https://");
    expect(reason).not.toContain("X-Amz-Signature");
    expect(reason).not.toContain("/documents/");
    expect(reason).toContain("[redacted-url]");
    expect(reason).toContain("[redacted-key]");
  });

  it("carries tenant document scope on retryable errors", () => {
    const error = toPdfGenerationRetryableError({
      documentId,
      companyId,
      cause: new CoreInvariantError("injected storage outage"),
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.pdfFailureClass).toBe("retryable");
    expect(readPdfRetryScope(error)).toEqual({ documentId, companyId });
    expect(error.clientMessage).toBe("PDF generation failed.");
    expect(error.message).toContain(documentId);
    expect(error.message).not.toContain("https://");
  });

  it("does not treat terminal snapshot errors as retry scope", () => {
    const terminal = new PdfGenerationTerminalError(
      'document money snapshot currency "USD" is not UAH',
    );
    expect(terminal).toBeInstanceOf(CoreInvariantError);
    expect(readPdfRetryScope(terminal)).toBeUndefined();
  });
});
