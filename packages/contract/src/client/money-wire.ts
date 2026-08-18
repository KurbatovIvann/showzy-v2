/**
 * Money at the client/action boundary (contract.md §3, db.md §3).
 *
 * Domain code uses `bigint` minor units (kopiykas). JSON and JavaScript
 * numbers cannot represent every 64-bit value, so the wire form is a
 * canonical base-10 string — never a JSON number, never an oRPC bigint
 * extension. Action Zod schemas stay JSON-safe (`moneyWireSchema`);
 * handlers and UI map with `moneyToWire` / `moneyFromWire`.
 */

import { z } from "zod";

/** Inclusive Postgres `bigint` / signed int64 range. */
export const INT64_MIN = -9223372036854775808n;
export const INT64_MAX = 9223372036854775807n;

/**
 * Canonical signed integer: `0` or a non-zero value without a leading
 * plus, leading zeros, decimal point, or exponent. `-0` is rejected so
 * the mapping is bijective with `bigint`.
 */
const CANONICAL_INT64 = /^(0|-?[1-9][0-9]*)$/;

/** Thrown when a money wire value is not a canonical signed int64 string. */
export class MoneyWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyWireError";
  }
}

export function isMoneyWire(value: string): boolean {
  if (!CANONICAL_INT64.test(value)) {
    return false;
  }
  const minor = BigInt(value);
  return minor >= INT64_MIN && minor <= INT64_MAX;
}

/**
 * JSON-safe Zod schema for money minor units on the wire. Does **not**
 * transform into `bigint` — that mapping stays at the action/client
 * boundary (contract.md §3).
 */
export const moneyWireSchema = z.string().refine(isMoneyWire, {
  message: "Expected a canonical signed int64 decimal string",
});

/** Encode domain minor units for the wire. */
export function moneyToWire(minor: bigint): string {
  if (minor < INT64_MIN || minor > INT64_MAX) {
    throw new MoneyWireError(
      `minor units ${minor.toString(10)} exceed the signed 64-bit range`,
    );
  }
  return minor.toString(10);
}

/** Decode a canonical wire string into domain minor units. */
export function moneyFromWire(encoded: string): bigint {
  if (!isMoneyWire(encoded)) {
    throw new MoneyWireError(
      "money wire value is not a canonical signed int64 decimal string",
    );
  }
  return BigInt(encoded);
}
