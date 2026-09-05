/**
 * Client sellability for order-form lines (SHO-423). Mirrors catalog
 * `resolve-line-references`: any variant rows (active or archived) means
 * the parent is not sellable; active variants mean one must be selected;
 * archived-only means unavailable. List `variantCount` may only count
 * active rows — overlay `catalog.getProduct` facts when present.
 */
export type OrderLineCatalogVariantRow = {
  readonly id: string;
  readonly status: "active" | "archived";
};

export type OrderLineCatalogFacts = {
  readonly variantRows: readonly OrderLineCatalogVariantRow[];
};

export type OrderLineCatalogFactsMap = ReadonlyMap<
  string,
  OrderLineCatalogFacts
>;

export type ProductSellability = "simple" | "variable" | "unavailable";

export function classifyProductSellability(
  variantRows: readonly OrderLineCatalogVariantRow[],
): ProductSellability {
  if (variantRows.length === 0) {
    return "simple";
  }
  const hasActive = variantRows.some((row) => row.status === "active");
  return hasActive ? "variable" : "unavailable";
}

export function overlayCatalogVariantCount(
  listVariantCount: number,
  facts: OrderLineCatalogFacts | undefined,
): number {
  return facts === undefined ? listVariantCount : facts.variantRows.length;
}

export function catalogFactsFromProduct(product: {
  readonly variants: readonly {
    readonly id: string;
    readonly status: "active" | "archived";
  }[];
}): OrderLineCatalogFacts {
  return {
    variantRows: product.variants.map((variant) => ({
      id: variant.id,
      status: variant.status,
    })),
  };
}

export function uniqueProductIds(
  ids: ReadonlyArray<string | null | undefined>,
): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (id === null || id === undefined || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}
