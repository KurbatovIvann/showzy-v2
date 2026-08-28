import { z } from "zod";

/**
 * Canonical signed integer minor units (money.md / contract.md §3). Local
 * copy — `*.contract.ts` cannot import `@showzy/contract`. Keep the regex
 * and int64 bounds in lockstep with `packages/contract/src/client/money-wire.ts`
 * and `packages/modules/catalog/src/wire.contract.ts`.
 */
const CANONICAL_INT64 = /^(0|-?[1-9][0-9]*)$/;

/** Inclusive Postgres `bigint` / signed int64 range. */
export const INT64_MIN = -9223372036854775808n;
export const INT64_MAX = 9223372036854775807n;

/** MVP is UAH-only (db.md §11); the column is reserved for a later ADR. */
export const DEFAULT_PRICE_CURRENCY = "UAH";
export const currencyCodeSchema = z.literal("UAH");

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

/** Price-list entry prices cannot be negative (`price_minor >= 0` CHECK). */
export const nonNegativeMoneyWireSchema = moneyWireSchema.refine(
  (value) => !value.startsWith("-"),
  { message: "Price must not be negative." },
);
