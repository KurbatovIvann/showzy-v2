/**
 * Display-only list vs catalog-base percent (SHO-304). Not a write
 * planner and not dirty detection — UI chrome on `PriceEntryRow`.
 */
import { parseMajorUnitsToMinor } from "../../../format/money-input";

export type PriceDiffTone = "empty" | "down" | "up" | "same";

/**
 * Display-only percent vs catalog base. Null when there is no entered
 * price or the catalog base is zero.
 */
export function priceDiffPercent(
  listMinor: bigint,
  baseMinor: bigint,
): number | null {
  if (baseMinor <= 0n) {
    return null;
  }
  const numerator = (listMinor - baseMinor) * 1000n;
  const half = baseMinor / 2n;
  const scaled =
    numerator >= 0n
      ? (numerator + half) / baseMinor
      : (numerator - half) / baseMinor;
  const rounded = scaled >= 0n ? (scaled + 5n) / 10n : (scaled - 5n) / 10n;
  return Number(rounded);
}

export function formatPriceDiffPercent(diff: number | null): string {
  if (diff === null) {
    return "—";
  }
  if (diff > 0) {
    return `+${String(diff)}%`;
  }
  return `${String(diff)}%`;
}

export function priceDiffTone(diff: number | null): PriceDiffTone {
  if (diff === null) {
    return "empty";
  }
  if (diff < 0) {
    return "down";
  }
  if (diff > 0) {
    return "up";
  }
  return "same";
}

export function listPriceDiff(args: {
  readonly priceText: string;
  readonly basePriceMinor: string;
}): { readonly label: string; readonly tone: PriceDiffTone } {
  if (args.priceText.trim().length === 0) {
    return { label: "—", tone: "empty" };
  }
  const parsed = parseMajorUnitsToMinor(args.priceText);
  if (!parsed.ok) {
    return { label: "—", tone: "empty" };
  }
  const diff = priceDiffPercent(parsed.minor, BigInt(args.basePriceMinor));
  return {
    label: formatPriceDiffPercent(diff),
    tone: priceDiffTone(diff),
  };
}
