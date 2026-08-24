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

export const productStatusSchema = z.enum(["active", "archived"]);
