import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { documentItems, documents } from "@showzy/db/schema/documents";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";

import {
  documentDiscountKindSchema,
  documentTaxTreatmentSchema,
  documentTemplateSourceSchema,
  documentViewSchema,
  buyerDetailsSchema,
  supplierDetailsSchema,
} from "../actions/document-view.contract.js";
import { parseStatus, parseType } from "./parse-document.js";

type ReadableDb =
  | Extract<ActionCtx, { principal: "staff" }>["db"]
  | Extract<ActionCtx, { principal: "public"; scope: "target" }>["db"];
type DocumentView = z.output<typeof documentViewSchema>;

export type StaffDocumentRecord = {
  readonly view: DocumentView;
  readonly signRequestedAt: string | null;
};

function parseDiscountKind(
  value: string,
): z.output<typeof documentDiscountKindSchema> {
  return parseDbEnum(
    documentDiscountKindSchema,
    value,
    `document_items row has illegal discount_kind "${value}"`,
  );
}

function parseTaxTreatment(
  value: string,
): z.output<typeof documentTaxTreatmentSchema> {
  return parseDbEnum(
    documentTaxTreatmentSchema,
    value,
    `document_items row has illegal tax_treatment "${value}"`,
  );
}

function parseTemplateSource(
  value: string,
): z.output<typeof documentTemplateSourceSchema> {
  return parseDbEnum(
    documentTemplateSourceSchema,
    value,
    `documents row has illegal template_source "${value}"`,
  );
}

function parseSupplier(value: unknown): z.output<typeof supplierDetailsSchema> {
  return parseDbEnum(
    supplierDetailsSchema,
    value,
    "documents row has illegal supplier_details",
  );
}

function parseBuyer(value: unknown): z.output<typeof buyerDetailsSchema> {
  return parseDbEnum(
    buyerDetailsSchema,
    value,
    "documents row has illegal buyer_details",
  );
}

async function loadStaffDocumentRecord(env: {
  readonly db: ReadableDb;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<StaffDocumentRecord> {
  const headerRows = await env.db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.companyId, env.companyId),
        eq(documents.id, env.documentId),
      ),
    )
    .limit(1);
  const header = headerRows[0];
  if (header === undefined) {
    throw new NotFoundError();
  }

  const lineRows = await env.db
    .select()
    .from(documentItems)
    .where(
      and(
        eq(documentItems.companyId, env.companyId),
        eq(documentItems.documentId, env.documentId),
      ),
    )
    .orderBy(asc(documentItems.createdAt), asc(documentItems.id));

  if (lineRows.length === 0) {
    throw new CoreInvariantError(
      `document ${env.documentId} has no line snapshots`,
    );
  }

  return {
    view: {
      documentId: header.id,
      orderId: header.orderId,
      counterpartyId: header.counterpartyId,
      type: parseType(header.type),
      status: parseStatus(header.status),
      documentNumber: header.documentNumber,
      issuedOn: header.issuedOn,
      supplierDetails: parseSupplier(header.supplierDetails),
      buyerDetails: parseBuyer(header.buyerDetails),
      totalNetMinor: moneyToCanonical(header.totalNetMinor),
      totalTaxMinor: moneyToCanonical(header.totalTaxMinor),
      totalGrossMinor: moneyToCanonical(header.totalGrossMinor),
      currency: header.currency,
      templateSource: parseTemplateSource(header.templateSource),
      templateName: header.templateName,
      createdAt: header.createdAt.toISOString(),
      items: lineRows.map((row) => ({
        itemId: row.id,
        productId: row.productId,
        variantId: row.variantId,
        titleSnapshot: row.titleSnapshot,
        quantityMilli: moneyToCanonical(row.quantityMilli),
        unitPriceMinor: moneyToCanonical(row.unitPriceMinor),
        discountKind: parseDiscountKind(row.discountKind),
        discountValue: moneyToCanonical(row.discountValue),
        discountAmountMinor: moneyToCanonical(row.discountAmountMinor),
        taxTreatment: parseTaxTreatment(row.taxTreatment),
        taxRateBp: row.taxRateBp,
        taxAmountMinor: moneyToCanonical(row.taxAmountMinor),
        netAmountMinor: moneyToCanonical(row.netAmountMinor),
        grossAmountMinor: moneyToCanonical(row.grossAmountMinor),
        currency: row.currency,
      })),
    },
    signRequestedAt:
      header.signRequestedAt === null
        ? null
        : header.signRequestedAt.toISOString(),
  };
}

export async function loadStaffDocument(env: {
  readonly db: ReadableDb;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<DocumentView> {
  const loaded = await loadStaffDocumentRecord(env);
  return loaded.view;
}

/**
 * Staff get (SHO-257) needs the HITL grant timestamp without putting it
 * on the shared `documentViewSchema` used by create/list/share.
 */
export async function loadStaffDocumentWithGrant(env: {
  readonly db: ReadableDb;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<StaffDocumentRecord> {
  return loadStaffDocumentRecord(env);
}
