/**
 * Unauthenticated HTML landing for `GET /d/:token` (SHO-235 / feature
 * SHO-227). Runs `documents.getShared` through the same pipeline as oRPC.
 * Not a customer cabinet. Do not log the token or a signed URL.
 */
import { executeAction, type ActionPipelineDeps } from "@showzy/core";
import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@showzy/core/errors";
import { getShared } from "@showzy/documents";

export const DOCUMENT_SHARE_LANDING_ROUTE = "/d/:token";

const TYPE_LABEL = {
  payment_invoice: "Рахунок",
  delivery_note: "Видаткова накладна",
} as const;

export const SHARE_LANDING_NOT_FOUND_COPY =
  "Посилання недійсне або строк його дії минув.";

export const SHARE_LANDING_REFRESH_COPY =
  "Файл ще не готовий або строк завантаження минув. Попросіть відправника оновити посилання.";

export const SHARE_LANDING_DOWNLOAD_COPY = "Завантажити PDF";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function formatMoneyMinor(minor: string, currency: string): string {
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const amount = `${negative ? "-" : ""}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  return `${amount} ${currency}`;
}

export type ShareLandingPage =
  | {
      readonly status: "ok";
      readonly type: "payment_invoice" | "delivery_note";
      readonly documentNumber: string;
      readonly totalGrossMinor: string;
      readonly currency: string;
      readonly pdfDownloadUrl: string | null;
    }
  | { readonly status: "not_found" }
  | { readonly status: "rate_limited" };

export function renderShareLandingHtml(page: ShareLandingPage): string {
  if (page.status === "not_found") {
    return wrapHtml("Документ", `<p>${SHARE_LANDING_NOT_FOUND_COPY}</p>`);
  }
  if (page.status === "rate_limited") {
    return wrapHtml("Документ", "<p>Забагато запитів. Спробуйте пізніше.</p>");
  }
  const title = `${TYPE_LABEL[page.type]} ${page.documentNumber}`;
  const safeTitle = escapeHtml(title);
  const amount = escapeHtml(
    formatMoneyMinor(page.totalGrossMinor, page.currency),
  );
  const download =
    page.pdfDownloadUrl !== null && isSafeHttpUrl(page.pdfDownloadUrl)
      ? `<p><a href="${escapeHtml(page.pdfDownloadUrl)}" rel="noopener noreferrer" referrerpolicy="no-referrer">${SHARE_LANDING_DOWNLOAD_COPY}</a></p>`
      : `<p>${SHARE_LANDING_REFRESH_COPY}</p>`;
  return wrapHtml(
    title,
    `<h1>${safeTitle}</h1><p>Сума: ${amount}</p>${download}`,
  );
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  ${body}
</body>
</html>`;
}

export interface ShareLandingResult {
  readonly status: 200 | 404 | 429 | 500;
  readonly html: string;
  readonly retryAfterSec?: number;
}

export async function executeDocumentShareLanding(options: {
  readonly pipeline: ActionPipelineDeps;
  readonly token: string;
  readonly requestId: string;
  readonly clientIp: string;
}): Promise<ShareLandingResult> {
  try {
    const output = await executeAction(options.pipeline, {
      action: getShared,
      input: { token: options.token },
      request: {
        requestId: options.requestId,
        correlationId: options.requestId,
        channel: "ui",
        clientIp: options.clientIp,
      },
      principal: { mode: "public" },
    });
    return {
      status: 200,
      html: renderShareLandingHtml({
        status: "ok",
        type: output.type,
        documentNumber: output.documentNumber,
        totalGrossMinor: output.totalGrossMinor,
        currency: output.currency,
        pdfDownloadUrl: output.pdfDownloadUrl,
      }),
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return {
        status: 404,
        html: renderShareLandingHtml({ status: "not_found" }),
      };
    }
    if (error instanceof RateLimitError) {
      return {
        status: 429,
        html: renderShareLandingHtml({ status: "rate_limited" }),
        retryAfterSec: error.retryAfterSec,
      };
    }
    options.pipeline.logger.error(
      {
        err: error,
        request_id: options.requestId,
        action: "documents.getShared",
      },
      "document share landing failed",
    );
    return {
      status: 500,
      html: renderShareLandingHtml({ status: "not_found" }),
    };
  }
}
