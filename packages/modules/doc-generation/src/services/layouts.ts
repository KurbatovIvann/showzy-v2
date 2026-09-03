import { CoreInvariantError, ValidationError } from "@showzy/core/errors";
import { z } from "zod";

import type {
  DocumentLayoutKey,
  DocumentLayoutType,
} from "../actions/layout.contract.js";

export const UNKNOWN_LAYOUT_KEY_MESSAGE = "Unknown document layout.";
export const LAYOUT_TYPE_MISMATCH_MESSAGE =
  "Layout key does not match document type.";

export type DocumentLayoutRow = {
  readonly key: DocumentLayoutKey;
  readonly type: DocumentLayoutType;
  readonly labelUk: string;
  readonly labelEn: string;
  readonly isDefault: boolean;
};

/**
 * System looks. One look per type: branded invoice, parties waybill.
 * Issued `template_name` equal to the document type still resolves to
 * that type's only catalog key.
 */
export const DOCUMENT_LAYOUTS: readonly DocumentLayoutRow[] = [
  {
    key: "payment_invoice.branded",
    type: "payment_invoice",
    labelUk: "Фірмовий рахунок",
    labelEn: "Branded invoice",
    isDefault: true,
  },
  {
    key: "delivery_note.parties",
    type: "delivery_note",
    labelUk: "Накладна зі сторонами",
    labelEn: "Parties delivery note",
    isDefault: true,
  },
];

const LAYOUT_BY_KEY = new Map<string, DocumentLayoutRow>(
  DOCUMENT_LAYOUTS.map((row) => [row.key, row]),
);

/** Issued `template_name` equal to the document type still renders the type default. */
const LEGACY_LAYOUT_ALIASES = {
  payment_invoice: "payment_invoice.branded",
  delivery_note: "delivery_note.parties",
} as const satisfies Record<DocumentLayoutType, DocumentLayoutKey>;

export function canonicalizeLayoutKey(
  layoutKey: string,
): DocumentLayoutKey | null {
  if (layoutKey === "payment_invoice" || layoutKey === "delivery_note") {
    return LEGACY_LAYOUT_ALIASES[layoutKey];
  }
  return LAYOUT_BY_KEY.get(layoutKey)?.key ?? null;
}

export function layoutRowForKey(key: DocumentLayoutKey): DocumentLayoutRow {
  const row = LAYOUT_BY_KEY.get(key);
  if (row === undefined) {
    throw new CoreInvariantError(`missing catalog row for ${key}`);
  }
  return row;
}

export function listDocumentLayouts(
  type?: DocumentLayoutType,
): readonly DocumentLayoutRow[] {
  if (type === undefined) {
    return DOCUMENT_LAYOUTS;
  }
  return DOCUMENT_LAYOUTS.filter((row) => row.type === type);
}

export function resolveDocumentLayout(input: {
  readonly layoutKey: string;
  readonly type: DocumentLayoutType;
}): { readonly key: DocumentLayoutKey; readonly type: DocumentLayoutType } {
  const canonical = canonicalizeLayoutKey(input.layoutKey);
  if (canonical === null) {
    const issue: z.core.$ZodIssue = {
      code: "custom",
      path: ["layoutKey"],
      message: UNKNOWN_LAYOUT_KEY_MESSAGE,
      input: input.layoutKey,
    };
    throw new ValidationError([issue], UNKNOWN_LAYOUT_KEY_MESSAGE);
  }
  const row = layoutRowForKey(canonical);
  if (row.type !== input.type) {
    const issue: z.core.$ZodIssue = {
      code: "custom",
      path: ["type"],
      message: LAYOUT_TYPE_MISMATCH_MESSAGE,
      input: input.type,
    };
    throw new ValidationError([issue], LAYOUT_TYPE_MISMATCH_MESSAGE);
  }
  return { key: row.key, type: row.type };
}
