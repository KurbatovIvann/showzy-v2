/**
 * v1 `obfuscate_seq` / `to_base36` (20260301000002_core_functions.sql)
 * ported to TypeScript. Sequence is per company (SHO-250); v1 used a
 * global `order_number_seq`.
 */

/** v1 `secret_multiplier`. */
export const OBFUSCATE_SEQ_MULTIPLIER = 73_856_093n;

/** v1 `secret_offset`. */
export const OBFUSCATE_SEQ_OFFSET = 12_345n;

/** v1 modulus `1000000007`. */
export const OBFUSCATE_SEQ_MODULUS = 1_000_000_007n;

const BASE36_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * v1 `to_base36`: uppercase 0-9A-Z, `0` when n is 0.
 */
export function toBase36(n: bigint): string {
  if (n < 0n) {
    throw new RangeError("toBase36 expects a non-negative bigint");
  }
  if (n === 0n) {
    return "0";
  }
  let remaining = n;
  let encoded = "";
  while (remaining > 0n) {
    const remainder = Number(remaining % 36n);
    const digit = BASE36_DIGITS[remainder];
    if (digit === undefined) {
      throw new RangeError("toBase36 remainder left the 0-35 range");
    }
    encoded = `${digit}${encoded}`;
    remaining = remaining / 36n;
  }
  return encoded;
}

/**
 * v1 `obfuscate_seq`: `(seq * 73856093 + 12345) % 1000000007` then
 * `to_base36`.
 */
export function obfuscateSeq(seq: bigint): string {
  if (seq < 1n) {
    throw new RangeError("obfuscateSeq expects a positive sequence");
  }
  const obfuscated =
    (seq * OBFUSCATE_SEQ_MULTIPLIER + OBFUSCATE_SEQ_OFFSET) %
    OBFUSCATE_SEQ_MODULUS;
  return toBase36(obfuscated);
}

/** `{prefix}-{obfuscate_seq(n)}` — the stored `orders.order_number`. */
export function formatStaffOrderNumber(prefix: string, seq: bigint): string {
  return `${prefix}-${obfuscateSeq(seq)}`;
}
