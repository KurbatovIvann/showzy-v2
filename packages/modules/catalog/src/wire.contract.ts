import { z } from "zod";

export {
  DEFAULT_PRODUCT_CURRENCY,
  PRODUCT_NAME_MAX,
  catalogNameSchema,
  currencyCodeSchema,
} from "@showzy/validation/catalog";

/**
 * Canonical signed integer minor units (money.md / contract.md §3). Local
 * copy — `*.contract.ts` cannot import `@showzy/contract`. Keep the regex
 * and int64 bounds in lockstep with `packages/contract/src/client/money-wire.ts`.
 * The regex is the OpenAPI-visible shape (orders `wire.contract.ts`); the
 * refine rejects values outside signed int64 that still match the digits.
 */
const CANONICAL_INT64 = /^(0|-?[1-9][0-9]*)$/;

/** Inclusive Postgres `bigint` / signed int64 range. */
export const INT64_MIN = -9223372036854775808n;
export const INT64_MAX = 9223372036854775807n;

function isSignedInt64Range(value: string): boolean {
  const minor = BigInt(value);
  return minor >= INT64_MIN && minor <= INT64_MAX;
}

export const moneyWireSchema = z
  .string()
  .regex(CANONICAL_INT64, "Expected a canonical signed int64 decimal string")
  .refine(isSignedInt64Range, {
    message: "Expected a canonical signed int64 decimal string",
  });

/** Catalog prices cannot be negative (products.base_price_minor CHECK). */
export const nonNegativeMoneyWireSchema = moneyWireSchema.refine(
  (value) => !value.startsWith("-"),
  { message: "Price must not be negative." },
);

export const productStatusSchema = z.enum(["active", "archived"]);
