import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import { getForGeneration } from "@showzy/documents";
import { recordGeneratedObject } from "@showzy/files";
import { postgresUniqueConstraint } from "@showzy/module-kit/postgres-unique";
import { sha256Hex } from "@showzy/module-kit/sha256";
import { and, eq } from "drizzle-orm";

import { artifactFileId } from "./artifact-file-id.js";
import { DOCUMENT_MIME_TYPE, putGeneratedPdf } from "./put-generated-pdf.js";
import { requireWritable } from "./writable.js";
import type { DocumentPdfModel } from "../templates/model.js";
import { renderDocumentPdfBytes } from "../templates/render-document.js";

export const JOBS_DOCUMENT_ID_UQ = "document_generation_jobs_document_id_uq";

type SystemTenantCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "tenant" }
>;

export type RenderPdfResult = {
  readonly status: "pending" | "ready" | "failed";
  readonly fileId: string | null;
  readonly documentId: string;
};

type JobRow = {
  readonly status: string;
  readonly fileId: string | null;
};

export function mapViewToPdfModel(view: {
  readonly type: "payment_invoice" | "delivery_note";
  readonly templateName: string;
  readonly documentNumber: string;
  readonly issuedOn: string;
  readonly currency: string;
  readonly supplierDetails: {
    readonly name: string;
    readonly companyType: "fop" | "tov";
    readonly legalName: string | null;
    readonly edrpou: string | null;
    readonly legalAddress: string | null;
    readonly iban: string | null;
    readonly bankName: string | null;
    readonly bankMfo: string | null;
    readonly phone: string | null;
    readonly email: string | null;
  };
  readonly buyerDetails:
    | {
        readonly kind: "customer";
        readonly displayName: string;
      }
    | {
        readonly kind: "counterparty";
        readonly name: string;
        readonly edrpou: string | null;
        readonly legalAddress: string | null;
        readonly iban: string | null;
        readonly bankName: string | null;
        readonly bankMfo: string | null;
        readonly phone: string | null;
        readonly email: string | null;
      };
  readonly items: readonly {
    readonly itemId: string;
    readonly titleSnapshot: string;
    readonly quantityMilli: string;
    readonly unitPriceMinor: string;
    readonly netAmountMinor: string;
    readonly grossAmountMinor: string;
  }[];
  readonly totalNetMinor: string;
  readonly totalTaxMinor: string;
  readonly totalGrossMinor: string;
}): DocumentPdfModel {
  if (view.currency !== "UAH") {
    throw new CoreInvariantError(
      `document money snapshot currency "${view.currency}" is not UAH`,
    );
  }
  return {
    type: view.type,
    templateName: view.templateName,
    documentNumber: view.documentNumber,
    issuedOn: view.issuedOn,
    currency: "UAH",
    basis: null,
    supplier: {
      name: view.supplierDetails.name,
      companyType: view.supplierDetails.companyType,
      legalName: view.supplierDetails.legalName,
      edrpou: view.supplierDetails.edrpou,
      legalAddress: view.supplierDetails.legalAddress,
      iban: view.supplierDetails.iban,
      bankName: view.supplierDetails.bankName,
      bankMfo: view.supplierDetails.bankMfo,
      phone: view.supplierDetails.phone,
      email: view.supplierDetails.email,
    },
    buyer: view.buyerDetails,
    items: view.items.map((item) => ({
      itemId: item.itemId,
      title: item.titleSnapshot,
      quantityMilli: item.quantityMilli,
      unitPriceMinor: item.unitPriceMinor,
      netAmountMinor: item.netAmountMinor,
      grossAmountMinor: item.grossAmountMinor,
    })),
    totalNetMinor: view.totalNetMinor,
    totalTaxMinor: view.totalTaxMinor,
    totalGrossMinor: view.totalGrossMinor,
  };
}

async function loadJob(
  ctx: SystemTenantCtx,
  documentId: string,
): Promise<JobRow | undefined> {
  const rows = await ctx.db
    .select({
      status: documentGenerationJobs.status,
      fileId: documentGenerationJobs.fileId,
    })
    .from(documentGenerationJobs)
    .where(
      and(
        eq(documentGenerationJobs.companyId, ctx.companyId),
        eq(documentGenerationJobs.documentId, documentId),
      ),
    )
    .limit(1);
  return rows[0];
}

async function insertPendingJob(
  ctx: SystemTenantCtx,
  documentId: string,
): Promise<void> {
  const db = requireWritable(ctx.db);
  try {
    await db.insert(documentGenerationJobs).values({
      companyId: ctx.companyId,
      documentId,
      status: "pending",
      fileId: null,
    });
  } catch (error) {
    if (postgresUniqueConstraint(error) !== JOBS_DOCUMENT_ID_UQ) {
      throw error;
    }
  }
}

async function markJob(
  ctx: SystemTenantCtx,
  documentId: string,
  values: {
    readonly status: "ready" | "failed";
    readonly fileId: string | null;
  },
): Promise<void> {
  const db = requireWritable(ctx.db);
  await db
    .update(documentGenerationJobs)
    .set({
      status: values.status,
      fileId: values.fileId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentGenerationJobs.companyId, ctx.companyId),
        eq(documentGenerationJobs.documentId, documentId),
      ),
    );
}

export async function renderTenantDocumentPdf(env: {
  readonly ctx: SystemTenantCtx;
  readonly documentId: string;
}): Promise<RenderPdfResult> {
  const { ctx, documentId } = env;
  const existing = await loadJob(ctx, documentId);
  if (
    existing !== undefined &&
    existing.status === "ready" &&
    existing.fileId !== null
  ) {
    return {
      status: "ready",
      fileId: existing.fileId,
      documentId,
    };
  }

  const view = await ctx.call(getForGeneration, { documentId });
  if (existing === undefined) {
    await insertPendingJob(ctx, documentId);
  }

  const fileId = artifactFileId(documentId);
  let bytes: Uint8Array;
  try {
    bytes = await renderDocumentPdfBytes(mapViewToPdfModel(view));
    await putGeneratedPdf({
      companyId: ctx.companyId,
      fileId,
      bytes,
    });
  } catch (error) {
    await markJob(ctx, documentId, { status: "failed", fileId: null });
    ctx.log.error(
      {
        document_id: documentId,
        err_name: error instanceof Error ? error.name : "unknown",
        err_message: error instanceof Error ? error.message : "non-error throw",
      },
      "docGeneration.renderPdf failed",
    );
    return { status: "failed", fileId: null, documentId };
  }

  await ctx.callAtomic(recordGeneratedObject, {
    fileId,
    purpose: "document",
    mimeType: DOCUMENT_MIME_TYPE,
    byteSize: bytes.byteLength,
    checksumSha256: sha256Hex(bytes),
  });
  await markJob(ctx, documentId, { status: "ready", fileId });
  return { status: "ready", fileId, documentId };
}
