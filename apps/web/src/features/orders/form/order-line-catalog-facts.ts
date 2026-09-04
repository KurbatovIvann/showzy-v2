/**
 * T4/T5 sellability for order-form lines (SHO-408). Any variant rows
 * (active or archived) means the parent is not sellable. List
 * `variantCount` may only count active rows — overlay `catalog.getProduct`
 * facts when present.
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

/** Mirrors picker `variantsStatus`: pending vs error stay distinct. */
export type CatalogFactsLoadStatus = "idle" | "loading" | "ready" | "error";

export type CatalogFactsQuerySnapshot = {
  readonly status: "pending" | "error" | "success";
};

export function catalogQueryLoadStatus(
  query: CatalogFactsQuerySnapshot | undefined,
): Exclude<CatalogFactsLoadStatus, "idle"> {
  if (query === undefined || query.status === "pending") {
    return "loading";
  }
  if (query.status === "error") {
    return "error";
  }
  return "ready";
}

export function classifyCatalogFactsLoad(
  draftProductIds: readonly string[],
  queryByProductId: ReadonlyMap<string, CatalogFactsQuerySnapshot | undefined>,
): CatalogFactsLoadStatus {
  if (draftProductIds.length === 0) {
    return "idle";
  }
  let sawLoading = false;
  let sawError = false;
  for (const productId of draftProductIds) {
    const load = catalogQueryLoadStatus(queryByProductId.get(productId));
    if (load === "loading") {
      sawLoading = true;
    }
    if (load === "error") {
      sawError = true;
    }
  }
  if (sawError) {
    return "error";
  }
  if (sawLoading) {
    return "loading";
  }
  return "ready";
}

export function catalogFactsBlockSubmit(
  status: CatalogFactsLoadStatus,
): boolean {
  return status === "loading" || status === "error";
}

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
