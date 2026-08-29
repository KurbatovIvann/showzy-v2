import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { documentItems, documents } from "@showzy/db/schema/documents";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";

import {
  documentDiscountKindSchema,
  documentStatusSchema,
  documentTaxTreatmentSchema,
  documentTemplateSourceSchema,
  documentTypeSchema,
  documentViewSchema,
  buyerDetailsSchema,
  supplierDetailsSchema,
} from "../actions/document-view.contract.js";
import { moneyToCanonical } from "./canonical.js";

type ReadableDb =
  | Extract<ActionCtx, { principal: "staff" }>["db"]
  | Extract<ActionCtx, { principal: "public"; scope: "target" }>["db"];
type DocumentView = z.output<typeof documentViewSchema>;

function parseType(value: string): z.output<typeof documentTypeSchema> {
  const parsed = documentTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(`documents row has illegal type "${value}"`);
  }
  return parsed.data;
}

function parseStatus(value: string): z.output<typeof documentStatusSchema> {
  const parsed = documentStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(`documents row has illegal status "${value}"`);
  }
  return parsed.data;
}

function parseDiscountKind(
  value: string,
): z.output<typeof documentDiscountKindSchema> {
  const parsed = documentDiscountKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `document_items row has illegal discount_kind "${value}"`,
    );
  }
  return parsed.data;
}

function parseTaxTreatment(
  value: string,
): z.output<typeof documentTaxTreatmentSchema> {
  const parsed = documentTaxTreatmentSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `document_items row has illegal tax_treatment "${value}"`,
    );
  }
  return parsed.data;
}

function parseTemplateSource(
  value: string,
): z.output<typeof documentTemplateSourceSchema> {
  const parsed = documentTemplateSourceSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `documents row has illegal template_source "${value}"`,
    );
  }
  return parsed.data;
}

function parseSupplier(value: unknown): z.output<typeof supplierDetailsSchema> {
  const parsed = supplierDetailsSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError("documents row has illegal supplier_details");
  }
  return parsed.data;
}

function parseBuyer(value: unknown): z.output<typeof buyerDetailsSchema> {
  const parsed = buyerDetailsSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError("documents row has illegal buyer_details");
  }
  return parsed.data;
}

export async function loadStaffDocument(env: {
  readonly db: ReadableDb;
  readonly companyId: string;
  readonly documentId: string;
}): Promise<DocumentView> {
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
  };
}
