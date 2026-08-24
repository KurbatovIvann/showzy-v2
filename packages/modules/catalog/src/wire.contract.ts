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

/** Catalog prices cannot be negative (products.base_price_minor CHECK). */
export const nonNegativeMoneyWireSchema = moneyWireSchema.refine(
  (value) => !value.startsWith("-"),
  { message: "Price must not be negative." },
);

/** ISO-like alphabetic code; MVP default is UAH (money.md). */
export const currencyCodeSchema = z.string().length(3);

export const DEFAULT_PRODUCT_CURRENCY = "UAH";

/** Same cap as `companies.create` (golden write). */
export const PRODUCT_NAME_MAX = 120;

export const catalogNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name must not be blank." })
  .max(PRODUCT_NAME_MAX);
