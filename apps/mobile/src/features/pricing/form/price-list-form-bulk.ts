/**
 * UI-only bulk percent-off for product-level price texts (SHO-304).
 * Variant rows stay untouched — not a promo engine.
 */
import { moneyToWire } from "@showzy/contract";

import { formatMajorUnitsFromMinor } from "../../../format/money-input";
import type { PriceListFormDraft } from "./price-list-form-draft";

const BULK_PERCENT_PATTERN = /^(100|[1-9]\d?)$/;

export function parseBulkPercent(
  text: string,
): { readonly ok: true; readonly percent: number } | { readonly ok: false } {
  const trimmed = text.trim().replace(",", ".");
  if (!BULK_PERCENT_PATTERN.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, percent: Number(trimmed) };
}

/**
 * Integer percent off catalog **product** base. Round half-up in minor
 * units so it matches canvas `Math.round` on major units.
 */
export function applyPercentOffMinor(
  baseMinor: bigint,
  percent: number,
): bigint {
  const numerator = baseMinor * (100n - BigInt(percent));
  return (numerator + 50n) / 100n;
}

export function applyBulkPercentOff(args: {
  readonly draft: PriceListFormDraft;
  readonly percent: number;
  readonly basePriceMinorByProductId: ReadonlyMap<string, string>;
}): PriceListFormDraft {
  return {
    ...args.draft,
    entries: args.draft.entries.map((entry) => {
      if (entry.variantId !== null) {
        return entry;
      }
      const base = args.basePriceMinorByProductId.get(entry.productId);
      if (base === undefined) {
        return entry;
      }
      const next = applyPercentOffMinor(BigInt(base), args.percent);
      return {
        ...entry,
        priceText: formatMajorUnitsFromMinor(moneyToWire(next)),
      };
    }),
  };
}
