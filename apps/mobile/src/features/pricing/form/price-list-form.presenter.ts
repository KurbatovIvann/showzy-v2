/**
 * Memoized price-list editor derivation (SHO-304). Rows/origin/header
 * stay out of the composer so keystroke work is O(changed entry), not
 * a new catalog map.
 */
import type { PricingFormCopy } from "../../../i18n/pricing";
import type {
  PriceListCatalogProduct,
  PriceListFormMode,
  PriceListFormOrigin,
  PriceListVariantMeta,
} from "./price-list-form-draft";
import type { PriceErrorKey } from "./price-list-form.schema";
import {
  visiblePriceEntries,
  type PriceListFormFieldRow,
  type VisiblePriceEntry,
} from "./price-list-form-rows";

export type PresentedPriceEntry = VisiblePriceEntry & {
  readonly originPriceText: string;
  readonly error: string | null;
};

export function presentPriceListFormHeader(
  mode: PriceListFormMode,
  copy: PricingFormCopy,
): string {
  return mode === "create" ? copy.createTitle : copy.editTitle;
}

export function presentOriginPriceText(
  origin: PriceListFormOrigin,
  entryKey: string,
): string {
  return origin.prices.get(entryKey) ?? "";
}

export function presentPriceListEntryError(
  entryErrors: Readonly<Record<string, PriceErrorKey>>,
  entryKey: string,
  invalidCopy: string,
): string | null {
  return entryErrors[entryKey] === "invalid" ? invalidCopy : null;
}

export function presentPriceListFormRows(args: {
  readonly products: readonly PriceListCatalogProduct[];
  readonly fields: readonly PriceListFormFieldRow[];
  readonly query: string;
  readonly expandedProductIds: ReadonlySet<string>;
  readonly expandingProductIds: ReadonlySet<string>;
  readonly variantMeta: ReadonlyMap<string, PriceListVariantMeta>;
  readonly origin: PriceListFormOrigin;
  readonly entryErrors: Readonly<Record<string, PriceErrorKey>>;
  readonly priceInvalidCopy: string;
}): readonly PresentedPriceEntry[] {
  return visiblePriceEntries(args).map((row) => ({
    ...row,
    originPriceText: presentOriginPriceText(args.origin, row.entryKey),
    error: presentPriceListEntryError(
      args.entryErrors,
      row.entryKey,
      args.priceInvalidCopy,
    ),
  }));
}
