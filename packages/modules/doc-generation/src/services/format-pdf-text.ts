import { CoreInvariantError } from "@showzy/core/errors";

/** `YYYY-MM-DD` → `DD.MM.YYYY` from the stored Kyiv calendar day. */
export function formatIssuedOn(issuedOn: string): string {
  const parts = issuedOn.split("-");
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    year.length !== 4 ||
    month.length !== 2 ||
    day.length !== 2
  ) {
    throw new CoreInvariantError(`issuedOn is not YYYY-MM-DD: ${issuedOn}`);
  }
  return `${day}.${month}.${year}`;
}

/** Canonical minor-unit string → Ukrainian decimal with a thin space grouping. */
export function formatMinorUnits(
  minor: string,
  fractionDigits: number,
): string {
  const negative = minor.startsWith("-");
  const digits = negative ? minor.slice(1) : minor;
  if (digits.length === 0 || !/^[0-9]+$/.test(digits)) {
    throw new CoreInvariantError(`illegal minor-unit string "${minor}"`);
  }
  const padded = digits.padStart(fractionDigits + 1, "0");
  const whole = padded.slice(0, -fractionDigits);
  const frac = padded.slice(-fractionDigits);
  const grouped = groupThousands(whole);
  const sign = negative ? "-" : "";
  return `${sign}${grouped},${frac}`;
}

function groupThousands(whole: string): string {
  const chars = [...whole];
  const parts: string[] = [];
  while (chars.length > 0) {
    parts.unshift(chars.splice(-3).join(""));
  }
  return parts.join(" ");
}

export function formatMoneyUah(minor: string): string {
  return `${formatMinorUnits(minor, 2)} грн`;
}

/** quantity_milli (scale 3) without trailing zero fractional digits. */
export function formatQuantityMilli(milli: string): string {
  if (!/^[1-9][0-9]*$/.test(milli)) {
    throw new CoreInvariantError(`illegal quantity_milli string "${milli}"`);
  }
  const padded = milli.padStart(4, "0");
  const whole = padded.slice(0, -3);
  const frac = padded.slice(-3).replace(/0+$/, "");
  return frac.length === 0
    ? groupThousands(whole)
    : `${groupThousands(whole)},${frac}`;
}
