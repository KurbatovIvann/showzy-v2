import { CoreInvariantError } from "@showzy/core/errors";

/** Quantity scale 3: 1 unit = 1000 milli (money.md). */
export const QUANTITY_MILLI_SCALE = 1000n;

/**
 * Round `numerator / denominator` to the nearest integer; ties go away
 * from zero (money.md).
 */
export function roundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator === 0n) {
    throw new CoreInvariantError("cannot round with a zero denominator");
  }
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded =
    remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export interface ExemptNoneLineAmounts {
  readonly discountKind: "none";
  readonly discountValue: bigint;
  readonly discountAmountMinor: bigint;
  readonly taxTreatment: "exempt";
  readonly taxRateBp: number;
  readonly taxAmountMinor: bigint;
  readonly netAmountMinor: bigint;
  readonly grossAmountMinor: bigint;
}

/**
 * Slice money path (SHO-89 / SHO-92): discount `none`, tax `exempt`.
 * `net + tax = gross`; tax is zero; net is the rounded line.
 */
export function computeExemptNoneLine(
  unitPriceMinor: bigint,
  quantityMilli: bigint,
): ExemptNoneLineAmounts {
  const netAmountMinor = roundHalfAwayFromZero(
    unitPriceMinor * quantityMilli,
    QUANTITY_MILLI_SCALE,
  );
  return {
    discountKind: "none",
    discountValue: 0n,
    discountAmountMinor: 0n,
    taxTreatment: "exempt",
    taxRateBp: 0,
    taxAmountMinor: 0n,
    netAmountMinor,
    grossAmountMinor: netAmountMinor,
  };
}

export function titleSnapshot(
  productName: string,
  variantName: string | undefined,
): string {
  if (variantName === undefined) {
    return productName;
  }
  return `${productName} · ${variantName}`;
}
