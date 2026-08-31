/**
 * Shared (productId, variantId) identity for price-list entry upserts
 * and deletes. Product-level rows omit variantId (`null`/`undefined`);
 * both encode as the same key so set/remove stay interchangeable (SHO-280).
 */
export type PriceListEntryKeyParts = {
  readonly productId: string;
  readonly variantId?: string | null | undefined;
};

export function entryKey(
  productId: string,
  variantId: string | null | undefined,
): string {
  const normalized = variantId ?? null;
  return normalized === null ? `${productId}|` : `${productId}|${normalized}`;
}

export function comparePriceListEntryKeys(
  left: PriceListEntryKeyParts,
  right: PriceListEntryKeyParts,
): number {
  if (left.productId !== right.productId) {
    return left.productId < right.productId ? -1 : 1;
  }
  const leftVariant = left.variantId ?? "";
  const rightVariant = right.variantId ?? "";
  if (leftVariant === rightVariant) {
    return 0;
  }
  return leftVariant < rightVariant ? -1 : 1;
}
