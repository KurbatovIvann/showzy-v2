/**
 * Document create draft and dirty detection (SHO-238). UI Zod lives in
 * `document-form.schema.ts`; write planning is `document-form-plan.ts`.
 */
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  documentFormDraftSchema,
  type DocumentFormFieldErrors,
  type DocumentFormType,
} from "./document-form.schema";

export {
  emptyFieldErrors,
  type DocumentFormFieldErrors,
  type DocumentFormType,
  type OrderErrorKey,
} from "./document-form.schema";

export type DocumentFormDraft = {
  type: DocumentFormType;
  orderId: string;
  counterpartyId: string;
};

export function emptyDocumentFormDraft(): DocumentFormDraft {
  return {
    type: "payment_invoice",
    orderId: "",
    counterpartyId: "",
  };
}

export function cloneDocumentFormDraft(
  values: DocumentFormDraft,
): DocumentFormDraft {
  return {
    type: values.type,
    orderId: values.orderId,
    counterpartyId: values.counterpartyId,
  };
}

export function isDocumentFormDirty(
  draft: DocumentFormDraft,
  origin: DocumentFormDraft,
): boolean {
  return (
    draft.type !== origin.type ||
    draft.orderId !== origin.orderId ||
    draft.counterpartyId !== origin.counterpartyId
  );
}

export function validateDocumentForm(
  draft: DocumentFormDraft,
): DocumentFormFieldErrors {
  const parsed = documentFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isDocumentFormValid(errors: DocumentFormFieldErrors): boolean {
  return errors.order === null;
}

export type DocumentFormUiParse =
  | { readonly ok: true; readonly draft: DocumentFormDraft }
  | { readonly ok: false; readonly errors: DocumentFormFieldErrors };

export function parseDocumentFormUiDraft(
  draft: DocumentFormDraft,
): DocumentFormUiParse {
  const errors = validateDocumentForm(draft);
  if (!isDocumentFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}
