/**
 * Money at the client/action boundary (contract.md §3, db.md §3).
 *
 * Domain code uses `bigint` minor units (kopiykas). JSON and JavaScript
 * numbers cannot represent every 64-bit value, so the wire form is a
 * canonical base-10 string — never a JSON number, never an oRPC bigint
 * extension. The Zod schema lives in `@showzy/validation/money` so
 * action contracts and this client mapping cannot drift. Handlers and
 * UI map with `moneyToWire` / `moneyFromWire`.
 */

import {
  INT64_MAX,
  INT64_MIN,
  isMoneyWire,
  moneyWireSchema,
} from "@showzy/validation/money";

export { INT64_MAX, INT64_MIN, isMoneyWire, moneyWireSchema };

/** Thrown when a money wire value is not a canonical signed int64 string. */
export class MoneyWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyWireError";
  }
}

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
