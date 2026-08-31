export function moneyToCanonical(minor: bigint): string {
  return minor.toString(10);
}

export function moneyFromCanonical(encoded: string): bigint {
  return BigInt(encoded);
}
