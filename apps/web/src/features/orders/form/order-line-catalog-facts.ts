/**
 * TanStack Query load-state for order-form catalog facts (SHO-423).
 * Domain sellability lives in `@showzy/validation/order-line-catalog-facts`.
 */
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
