import { z } from "zod";

/**
 * Canonical signed integer minor units (money.md / contract.md §3): `0` or a
 * non-zero value without a leading plus, leading zeros, decimal, or exponent.
 * Local copy — `*.contract.ts` cannot import `@showzy/contract`.
 */
export const moneyWireSchema = z
  .string()
  .regex(
    /^(0|-?[1-9][0-9]*)$/,
    "Expected a canonical signed int64 decimal string",
  );

/**
 * Canonical positive quantity_milli (scale 3): no plus, leading zeros,
 * decimal, exponent, or zero.
 */
export const quantityMilliWireSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Expected a canonical positive integer string");

/** Calendar day `YYYY-MM-DD` (Kyiv `issued_on`, not an instant). */
export const calendarDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD calendar day");
