/**
 * Staff document list (SHO-233 / feature SHO-227). Copy `orders.list` and
 * the `customers.listCounterparties` empty-page filter; do not invent a
 * second list shape:
 * - Pagination is a stable `(createdAt desc, id desc)` cursor, not offset.
 *   `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `createdAtISO|id`.
 * - `type` defaults to `all`; `payment_invoice` and `delivery_note` are
 *   explicit. No search. No order-status filter or field on the row.
 * - Optional `orderId`: own-tenant filter. Missing and other-tenant order
 *   ids yield an empty page (no existence leak), not not-found.
 * - List rows are not the get view: header fields plus `buyerLabel` from
 *   the stored buyer snapshot (counterparty legal name or customer
 *   `displayName`). Do not live-join CRM.
 * - Input is a strict object so `companyId` cannot be smuggled in
 *   (ADR-0013).
 * - `timeout: 10000` covers nested `docSigning.getSupplierSignedFlags`
 *   (5000) plus the page query.
 * - `idempotent: false` like other staff reads: core.md §5 treats reads as
 *   naturally idempotent (no key, no storage).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { calendarDaySchema, moneyWireSchema } from "../wire.contract.js";
import {
  documentStatusSchema,
  documentTypeSchema,
} from "./document-view.contract.js";

export const LIST_DOCUMENTS_DEFAULT_LIMIT = 20;
export const LIST_DOCUMENTS_MAX_LIMIT = 50;
export const LIST_DOCUMENTS_CURSOR_MAX = 80;

const listDocumentsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export function formatListDocumentsCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function parseListDocumentsCursor(
  cursor: string,
): z.output<typeof listDocumentsCursorPayloadSchema> | undefined {
  const separator = cursor.indexOf("|");
  if (separator <= 0 || separator !== cursor.lastIndexOf("|")) {
    return undefined;
  }
  const parsed = listDocumentsCursorPayloadSchema.safeParse({
    createdAt: cursor.slice(0, separator),
    id: cursor.slice(separator + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listDocumentsTypeFilterSchema = z.enum([
  "payment_invoice",
  "delivery_note",
  "all",
]);

export const listDocumentsInputSchema = z.strictObject({
  type: listDocumentsTypeFilterSchema.default("all"),
  orderId: z.uuid().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_DOCUMENTS_MAX_LIMIT)
    .default(LIST_DOCUMENTS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(LIST_DOCUMENTS_CURSOR_MAX)
    .refine((value) => parseListDocumentsCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listDocumentRowSchema = z.object({
  documentId: z.uuid(),
  type: documentTypeSchema,
  documentNumber: z.string().min(1),
  orderId: z.uuid(),
  counterpartyId: z.uuid().nullable(),
  status: documentStatusSchema,
  totalGrossMinor: moneyWireSchema,
  currency: z.string().length(3),
  issuedOn: calendarDaySchema,
  createdAt: z.iso.datetime(),
  buyerLabel: z.string().min(1),
  supplierSigned: z.boolean(),
});

export const listDocumentsOutputSchema = z.object({
  items: z.array(listDocumentRowSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listDocumentsContract = defineActionContract({
  name: "documents.list",
  description:
    "List issued and cancelled documents in the staff member's active company. Default type all includes payment invoices and delivery notes; pass a CHECK type to filter. Optional orderId returns an empty page for a missing or foreign order. Paginate with a created-at/id cursor and a page size of at most 50. Each row includes documentId, type, documentNumber, orderId, nullable counterpartyId, status, total gross, currency, issuedOn, createdAt, buyerLabel from the stored buyer snapshot, and supplierSigned from one nested docSigning.getSupplierSignedFlags call per page — not the get view, line snapshots, or live CRM. Company id is never input. Does not search.",
  principal: "staff",
  transport: "client",
  input: listDocumentsInputSchema,
  output: listDocumentsOutputSchema,
  permissions: ["documents:view"],
  aiExposure: "exposed",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 10_000,
});
