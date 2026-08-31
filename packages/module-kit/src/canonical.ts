import { CoreInvariantError } from "@showzy/core/errors";

export function moneyToCanonical(minor: bigint): string {
  return minor.toString(10);
}

export function moneyFromCanonical(encoded: string): bigint {
  return BigInt(encoded);
}

export function requireUah(currency: string): "UAH" {
  if (currency !== "UAH") {
    throw new CoreInvariantError("expected UAH (db.md §11 UAH-only MVP)");
  }
  return "UAH";
}

export function requireUahOrNull(currency: string | null): "UAH" | null {
  if (currency === null) {
    return null;
  }
  return requireUah(currency);
}
