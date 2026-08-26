/**
 * Pure view-model logic for the products list (SHO-137). No React
 * Native imports so the whole decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import { formatMoneyMinor } from "../../../../format/money";
import type {
  ListProductsPageInput,
  ProductListItem,
  ProductsStatusFilter,
} from "../api/products-list-query";

/** Matches the `catalog.listProducts` contract query cap. */
export const PRODUCTS_SEARCH_MAX_LENGTH = 100;

/** Empty and whitespace-only searches are "no search" — the action rejects them. */
export function normalizeProductsSearch(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, PRODUCTS_SEARCH_MAX_LENGTH);
}

export function listProductsPageInput(
  filter: ProductsStatusFilter,
  search: string | undefined,
): ListProductsPageInput {
  return {
    status: filter,
    ...(search === undefined ? {} : { query: search }),
  };
}

export function flattenProductPages(
  pages: ReadonlyArray<{ readonly items: readonly ProductListItem[] }>,
): readonly ProductListItem[] {
  return pages.flatMap((page) => page.items);
}

/** First-seen unique `primaryImageFileId` values for one list page. */
export function uniquePrimaryImageFileIds(
  items: ReadonlyArray<{ readonly primaryImageFileId: string | null }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fileId = item.primaryImageFileId;
    if (fileId === null || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    ids.push(fileId);
  }
  return ids;
}

export function mergeDownloadUrlPages(
  pages: ReadonlyArray<
    | {
        readonly files: ReadonlyArray<{
          readonly fileId: string;
          readonly downloadUrl: string;
        }>;
      }
    | undefined
  >,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    if (page === undefined) {
      continue;
    }
    for (const file of page.files) {
      map.set(file.fileId, file.downloadUrl);
    }
  }
  return map;
}

export type ProductRowView = {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly variantCount: number;
  readonly primaryImageFileId: string | null;
};

export function toProductRowView(item: ProductListItem): ProductRowView {
  return {
    id: item.id,
    name: item.name,
    priceLabel: formatMoneyMinor(item.basePriceMinor, item.currency),
    archived: item.status === "archived",
    variantCount: item.variantCount,
    primaryImageFileId: item.primaryImageFileId,
  };
}

export type ProductsProbeState =
  "idle" | "loading" | "empty" | "nonempty" | "error";

export function productsProbeState(args: {
  readonly enabled: boolean;
  readonly status: "pending" | "error" | "success";
  readonly itemCount: number | undefined;
}): ProductsProbeState {
  if (!args.enabled) {
    return "idle";
  }
  if (args.status === "pending") {
    return "loading";
  }
  if (args.status === "error") {
    return "error";
  }
  return (args.itemCount ?? 0) > 0 ? "nonempty" : "empty";
}

export type ProductsListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-search" }
  | { readonly kind: "empty-archived" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "empty-active" }
  | { readonly kind: "rows" };

/**
 * Canvas state machine: skeletons while loading, offline vs error
 * empty-states, then per-filter empty states. An empty active filter
 * consults the probe to tell "catalog is empty" (create CTA) apart
 * from "everything is archived" (show-all CTA); a failed probe falls
 * back to the catalog-empty state rather than a second error screen.
 */
export function classifyProductsList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly hasSearch: boolean;
  readonly filter: ProductsStatusFilter;
  readonly probe: ProductsProbeState;
}): ProductsListState {
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    return args.failureKind === "offline"
      ? { kind: "offline" }
      : { kind: "error" };
  }
  if (args.rowCount > 0) {
    return { kind: "rows" };
  }
  if (args.hasSearch) {
    return { kind: "empty-search" };
  }
  if (args.filter === "archived") {
    return { kind: "empty-archived" };
  }
  if (args.filter === "all") {
    return { kind: "empty-catalog" };
  }
  if (args.probe === "loading" || args.probe === "idle") {
    return { kind: "loading" };
  }
  return args.probe === "nonempty"
    ? { kind: "empty-active" }
    : { kind: "empty-catalog" };
}
