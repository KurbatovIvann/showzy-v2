/**
 * Major-unit money typing for catalog forms (SHO-139).
 *
 * The field stores the user's text. Conversion to canonical minor-unit
 * wire strings happens at the submit boundary with bigint math — never
 * `Number` / floats (money.md). Accepts a comma or a dot as the decimal
 * mark and strips grouping spaces; more than two kopiyka digits is
 * rejected rather than rounded.
 */
import { INT64_MAX, moneyFromWire, moneyToWire } from "@showzy/contract";

const GROUPING = /[\u00A0\u202F\s]/g;
const SEPARATOR = /[,.]/;

export type MajorUnitsParseFailure = "empty" | "invalid";

export type MajorUnitsParseResult =
  | { readonly ok: true; readonly minor: bigint }
  | { readonly ok: false; readonly error: MajorUnitsParseFailure };

/**
 * Parse a major-unit amount (hryvnias) into kopiyka minor units.
 * Empty input is a distinct failure so the form can require a product
 * price while treating an empty variant override as "inherit".
 */
export function parseMajorUnitsToMinor(text: string): MajorUnitsParseResult {
  const stripped = text.trim().replace(GROUPING, "");
  if (stripped.length === 0) {
    return { ok: false, error: "empty" };
  }
  if (stripped.startsWith("-") || stripped.startsWith("−")) {
    return { ok: false, error: "invalid" };
  }

  let separatorIndex = -1;
  for (let index = 0; index < stripped.length; index += 1) {
    const char = stripped.charAt(index);
    if (SEPARATOR.test(char)) {
      if (separatorIndex !== -1) {
        return { ok: false, error: "invalid" };
      }
      separatorIndex = index;
      continue;
    }
    if (char < "0" || char > "9") {
      return { ok: false, error: "invalid" };
    }
  }

  const integerDigits =
    separatorIndex === -1 ? stripped : stripped.slice(0, separatorIndex);
  const fractionDigits =
    separatorIndex === -1 ? "" : stripped.slice(separatorIndex + 1);
  if (fractionDigits.length > 2) {
    return { ok: false, error: "invalid" };
  }
  if (integerDigits.length === 0 && fractionDigits.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const units = BigInt(integerDigits.length === 0 ? "0" : integerDigits);
  const cents = BigInt(fractionDigits.padEnd(2, "0") || "0");
  const minor = units * 100n + cents;
  if (minor > INT64_MAX) {
    return { ok: false, error: "invalid" };
  }
  return { ok: true, minor };
}

/**
 * Prefill a money field from a canonical wire string. No grouping — the
 * user is about to edit. Zero kopiykas are omitted, matching
 * `formatMoneyMinor`.
 */
export function formatMajorUnitsFromMinor(wire: string): string {
  const minor = moneyFromWire(wire);
  if (minor < 0n) {
    throw new RangeError("catalog prices cannot be negative");
  }
  const units = minor / 100n;
  const cents = minor % 100n;
  if (cents === 0n) {
    return units.toString(10);
  }
  return `${units.toString(10)},${cents.toString(10).padStart(2, "0")}`;
}

/** Canonical wire string at the action boundary. */
export function majorUnitsToWire(text: string): MajorUnitsParseResult & {
  readonly wire?: string;
} {
  const parsed = parseMajorUnitsToMinor(text);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, minor: parsed.minor, wire: moneyToWire(parsed.minor) };
}
