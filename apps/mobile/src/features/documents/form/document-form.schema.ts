/**
 * UI draft Zod for the document create form (SHO-238). This is not the
 * action wire schema — the planner emits `{ orderId, type, counterpartyId? }`
 * only.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const DOCUMENT_FORM_TYPES = [
  "payment_invoice",
  "delivery_note",
] as const;

export type DocumentFormType = (typeof DOCUMENT_FORM_TYPES)[number];

export type OrderErrorKey = "required";

export type DocumentFormFieldErrors = {
  readonly order: OrderErrorKey | null;
};

export function emptyFieldErrors(): DocumentFormFieldErrors {
  return { order: null };
}

export function isOrderErrorKey(value: string): value is OrderErrorKey {
  return value === "required";
}

export const documentFormDraftSchema = z.object({
  type: z.enum(DOCUMENT_FORM_TYPES),
  orderId: z.string().refine((value) => value.length > 0, {
    message: "required",
  }),
  counterpartyId: z.string(),
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
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "orderId" && isOrderErrorKey(issue.message)) {
      order = issue.message;
    }
  }
  return { order };
}
