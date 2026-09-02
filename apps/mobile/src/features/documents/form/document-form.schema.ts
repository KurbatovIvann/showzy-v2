/**
 * UI draft Zod for the document create form (SHO-238 / SHO-366). This is
 * not the action wire schema — the planner emits
 * `{ orderId, type, counterpartyId?, layoutKey, basis? }`.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { DOCUMENT_BASIS_MAX } from "../shared/document-caps";

export const DOCUMENT_FORM_TYPES = [
  "payment_invoice",
  "delivery_note",
] as const;

export type DocumentFormType = (typeof DOCUMENT_FORM_TYPES)[number];

export type OrderErrorKey = "required";
export type LayoutErrorKey = "required";
export type BasisErrorKey = "too_long";

export type DocumentFormFieldErrors = {
  readonly order: OrderErrorKey | null;
  readonly layout: LayoutErrorKey | null;
  readonly basis: BasisErrorKey | null;
};

export function emptyFieldErrors(): DocumentFormFieldErrors {
  return { order: null, layout: null, basis: null };
}

export function isOrderErrorKey(value: string): value is OrderErrorKey {
  return value === "required";
}

export function isLayoutErrorKey(value: string): value is LayoutErrorKey {
  return value === "required";
}

export function isBasisErrorKey(value: string): value is BasisErrorKey {
  return value === "too_long";
}

export const documentFormDraftSchema = z.object({
  type: z.enum(DOCUMENT_FORM_TYPES),
  orderId: z.string().refine((value) => value.length > 0, {
    message: "required",
  }),
  counterpartyId: z.string(),
  layoutKey: z.string().refine((value) => value.length > 0, {
    message: "required",
  }),
  basis: z.string().max(DOCUMENT_BASIS_MAX, { message: "too_long" }),
});

export const documentFormResolver = zodResolver(documentFormDraftSchema);

/**
 * Map UI-schema issues onto field copy keys. Schema `message` values
 * are keys, never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): DocumentFormFieldErrors {
  let order: OrderErrorKey | null = null;
  let layout: LayoutErrorKey | null = null;
  let basis: BasisErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "orderId" && isOrderErrorKey(issue.message)) {
      order = issue.message;
    }
    if (root === "layoutKey" && isLayoutErrorKey(issue.message)) {
      layout = issue.message;
    }
    if (root === "basis" && isBasisErrorKey(issue.message)) {
      basis = issue.message;
    }
  }
  return { order, layout, basis };
}
