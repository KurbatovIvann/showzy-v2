import { requireOrValidationError } from "@showzy/module-kit/require";
import {
  GRANT_EXPIRED_MESSAGE,
  GRANT_MISSING_MESSAGE,
  PDF_NOT_READY_MESSAGE,
  grantFreshGate,
  grantPresentGate,
  isSignRequestGrantFresh,
  isSignRequestGrantPresent,
  readyPdfGate,
} from "@showzy/validation/signing";

export function requireUnexpiredGrant(signRequestedAt: Date | null): void {
  requireOrValidationError(
    grantPresentGate,
    { present: isSignRequestGrantPresent(signRequestedAt) },
    GRANT_MISSING_MESSAGE,
  );
  requireOrValidationError(
    grantFreshGate,
    { fresh: isSignRequestGrantFresh(signRequestedAt) },
    GRANT_EXPIRED_MESSAGE,
  );
}

export function requireReadyPdf(
  fileId: string | null,
): asserts fileId is string {
  requireOrValidationError(
    readyPdfGate,
    { present: fileId !== null },
    PDF_NOT_READY_MESSAGE,
  );
}
