/**
 * Canonical money and quantity wire schemas (SHO-284 / validation-T1).
 *
 * Domain code uses `bigint` minor units (kopiykas). JSON and JavaScript
 * numbers cannot represent every 64-bit value, so the wire form is a
 * canonical base-10 string. Action Zod schemas stay JSON-safe; mapping
 * to `bigint` stays at the action/client boundary (`moneyToWire` /
 * `moneyFromWire` in `@showzy/contract`).
 *
 * Inclusive Postgres `bigint` / signed int64 range is part of the schema
 * so an oversized amount fails Zod (400) instead of overflowing later.
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

export const MONEY_WIRE_MESSAGE =
  "Expected a canonical signed int64 decimal string";

/** True when `value` is a canonical signed int64 decimal string. */
export function isMoneyWire(value: string): boolean {
  if (!CANONICAL_INT64.test(value)) {
    return false;
  }
  const minor = BigInt(value);
  return minor >= INT64_MIN && minor <= INT64_MAX;
}

/**
 * JSON-safe Zod schema for money minor units on the wire. The regex is
 * the OpenAPI-visible shape; the refine rejects values outside signed
 * int64 that still match the digits. Does **not** transform into
 * `bigint`. Refine is safe to run when the regex already failed (Zod 4
 * still invokes later checks).
 */
export const moneyWireSchema = z
  .string()
  .regex(CANONICAL_INT64, MONEY_WIRE_MESSAGE)
  .refine(isMoneyWire, { message: MONEY_WIRE_MESSAGE });

/**
 * Catalog and price-list entry prices cannot be negative (CHECK
 * `base_price_minor >= 0` / `price_minor >= 0`).
 */
export const nonNegativeMoneyWireSchema = moneyWireSchema.refine(
  (value) => !value.startsWith("-"),
  { message: "Price must not be negative." },
);

/**
 * Canonical positive quantity_milli (scale 3): no plus, leading zeros,
 * decimal, exponent, or zero.
 */
export const quantityMilliWireSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Expected a canonical positive integer string");
