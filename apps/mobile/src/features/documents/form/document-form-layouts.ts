/**
 * System layout catalog helpers for the document create form (SHO-366).
 * Labels and defaults come from `docGeneration.listLayouts`, not a
 * client-side key table. Company id is never input.
 */
import type { Locale } from "../../../i18n/locale";
import type { DocumentFormType } from "./document-form.schema";

export type DocumentLayoutOption = {
  readonly key: string;
  readonly type: DocumentFormType;
  readonly labelUk: string;
  readonly labelEn: string;
  readonly isDefault: boolean;
};

export function defaultLayoutKey(
  layouts: readonly DocumentLayoutOption[],
): string | null {
  const marked = layouts.find((row) => row.isDefault);
  if (marked !== undefined) {
    return marked.key;
  }
  return layouts[0]?.key ?? null;
}

export function layoutCardLabel(
  layout: DocumentLayoutOption,
  locale: Locale,
): string {
  return locale === "en" ? layout.labelEn : layout.labelUk;
}

export function layoutKeyIsOffered(
  layouts: readonly DocumentLayoutOption[],
  layoutKey: string,
): boolean {
  return layouts.some((row) => row.key === layoutKey);
}

/**
 * Keep the current key when it is still offered; otherwise the type's
 * `isDefault` (or the first row). Empty catalog → empty string.
 */
export function nextLayoutKeyOnCatalog(
  layouts: readonly DocumentLayoutOption[],
  currentKey: string,
): string {
  if (layoutKeyIsOffered(layouts, currentKey)) {
    return currentKey;
  }
  return defaultLayoutKey(layouts) ?? "";
}

export function showsBasisField(type: DocumentFormType): boolean {
  return type === "delivery_note";
}

export type DocumentFormLayoutsStatus = "loading" | "ready" | "error";

/** Hide the look picker unless staff must choose or retry a failed catalog. */
export function showsLayoutPicker(
  status: DocumentFormLayoutsStatus,
  cardCount: number,
): boolean {
  if (status === "error") {
    return true;
  }
  if (status === "loading") {
    return false;
  }
  return cardCount > 1;
}

/**
 * Wire `basis` only for delivery notes with a non-empty trim. Empty /
 * whitespace → omit (server stores null). Invoices never send `basis`.
 */
export function wireBasis(
  type: DocumentFormType,
  basis: string,
): string | undefined {
  if (type !== "delivery_note") {
    return undefined;
  }
  const trimmed = basis.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
