/**
 * Pure view-model logic for the product detail screen (SHO-138). No
 * React Native imports so the decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import { interpolate } from "../../../i18n/locale";
import type { ProductsDetailCopy } from "../../../i18n/products";
import type { CatalogStatusWrite } from "./product-archive";
import type {
  GetProductOutput,
  GetProductVariant,
} from "./product-detail-query";

/** Contract `productId` / `variantId` are UUIDs; refuse anything else. */
export const PRODUCT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function productIdFromParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  return PRODUCT_ID_PATTERN.test(raw) ? raw : null;
}

export type ProductDetailState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "ready" };

export function classifyProductDetail(args: {
  readonly productId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductDetailState {
  if (args.productId === null) {
    return { kind: "not-found" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    if (args.failureKind === "offline") {
      return { kind: "offline" };
    }
    if (args.failureKind === "not_found") {
      return { kind: "not-found" };
    }
    return { kind: "error" };
  }
  return { kind: "ready" };
}

export type ProductVariantView = {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly priceLabel: string;
  readonly priceInherited: boolean;
};

export type ProductDetailViewModel = {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly imageFileIds: readonly string[];
  readonly variants: readonly ProductVariantView[];
};

function variantPrice(args: {
  readonly variant: GetProductVariant;
  readonly productPrice: string;
  readonly productCurrency: string;
}): { readonly priceLabel: string; readonly priceInherited: boolean } {
  if (args.variant.basePriceMinor === null) {
    return {
      priceLabel: formatMoneyMinor(args.productPrice, args.productCurrency),
      priceInherited: true,
    };
  }
  return {
    priceLabel: formatMoneyMinor(
      args.variant.basePriceMinor,
      args.variant.currency ?? args.productCurrency,
    ),
    priceInherited: false,
  };
}

export function toProductDetailView(
  product: GetProductOutput,
): ProductDetailViewModel {
  return {
    id: product.id,
    name: product.name,
    priceLabel: formatMoneyMinor(product.basePriceMinor, product.currency),
    archived: product.status === "archived",
    imageFileIds: product.imageFileIds,
    variants: product.variants.map((variant) => {
      const price = variantPrice({
        variant,
        productPrice: product.basePriceMinor,
        productCurrency: product.currency,
      });
      return {
        id: variant.id,
        name: variant.name,
        archived: variant.status === "archived",
        priceLabel: price.priceLabel,
        priceInherited: price.priceInherited,
      };
    }),
  };
}

export type ConfirmTarget =
  | { readonly kind: "archive-product" }
  | { readonly kind: "restore-product" }
  | {
      readonly kind: "archive-variant";
      readonly variantId: string;
      readonly variantName: string;
    }
  | {
      readonly kind: "restore-variant";
      readonly variantId: string;
      readonly variantName: string;
    };

export function confirmTargetForProduct(archived: boolean): ConfirmTarget {
  return archived ? { kind: "restore-product" } : { kind: "archive-product" };
}

export function confirmTargetForVariant(args: {
  readonly archived: boolean;
  readonly variantId: string;
  readonly variantName: string;
}): ConfirmTarget {
  return args.archived
    ? {
        kind: "restore-variant",
        variantId: args.variantId,
        variantName: args.variantName,
      }
    : {
        kind: "archive-variant",
        variantId: args.variantId,
        variantName: args.variantName,
      };
}

export type ConfirmSheetCopy = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
};

export function confirmSheetCopy(
  target: ConfirmTarget,
  copy: ProductsDetailCopy,
): ConfirmSheetCopy {
  switch (target.kind) {
    case "archive-product":
      return {
        title: copy.confirmArchiveProductTitle,
        description: copy.confirmArchiveProductDescription,
        confirmLabel: copy.archiveProduct,
      };
    case "restore-product":
      return {
        title: copy.confirmRestoreProductTitle,
        description: copy.confirmRestoreProductDescription,
        confirmLabel: copy.restoreProduct,
      };
    case "archive-variant":
      return {
        title: copy.confirmArchiveVariantTitle,
        description: interpolate(copy.confirmArchiveVariantDescription, {
          name: target.variantName,
        }),
        confirmLabel: copy.archiveVariant,
      };
    case "restore-variant":
      return {
        title: copy.confirmRestoreVariantTitle,
        description: interpolate(copy.confirmRestoreVariantDescription, {
          name: target.variantName,
        }),
        confirmLabel: copy.restoreVariant,
      };
  }
}

export function statusWriteForConfirm(
  target: ConfirmTarget,
  productId: string,
): CatalogStatusWrite {
  switch (target.kind) {
    case "archive-product":
      return { kind: "archiveProduct", productId };
    case "restore-product":
      return { kind: "restoreProduct", productId };
    case "archive-variant":
      return { kind: "archiveVariant", variantId: target.variantId };
    case "restore-variant":
      return { kind: "restoreVariant", variantId: target.variantId };
  }
}

export type StatusWriteBannerKey = "offline" | "permission" | "error";

export function mapStatusWriteFailure(
  kind: QueryFailureKind | null,
): StatusWriteBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "offline") {
    return "offline";
  }
  if (kind === "permission") {
    return "permission";
  }
  return "error";
}

export function statusWriteBanner(
  key: StatusWriteBannerKey | null,
  copy: ProductsDetailCopy,
): string | null {
  if (key === null) {
    return null;
  }
  if (key === "offline") {
    return copy.mutationOffline;
  }
  if (key === "permission") {
    return copy.mutationPermission;
  }
  return copy.mutationError;
}

export function galleryPageIndex(args: {
  readonly offsetX: number;
  readonly pageWidth: number;
  readonly pageCount: number;
}): number {
  if (args.pageWidth <= 0 || args.pageCount <= 0) {
    return 0;
  }
  const page = Math.round(args.offsetX / args.pageWidth);
  return Math.min(args.pageCount - 1, Math.max(0, page));
}

/**
 * Gallery empty copy is only for a product with no photos. Fetching
 * (`files.getDownloadUrl`) is gated separately so an employee still
 * sees that photos exist, and so layout measurement never flashes the
 * empty label.
 */
export type ProductGalleryMode =
  "empty" | "pending-layout" | "no-fetch" | "images";

export function classifyProductGallery(args: {
  readonly fileCount: number;
  readonly canFetchImages: boolean;
  readonly pageWidth: number | undefined;
}): ProductGalleryMode {
  if (args.fileCount <= 0) {
    return "empty";
  }
  if (args.pageWidth === undefined || args.pageWidth <= 0) {
    return "pending-layout";
  }
  if (!args.canFetchImages) {
    return "no-fetch";
  }
  return "images";
}

/** Failed confirm reuses the in-flight attempt; a fresh confirm submits. */
export function planConfirmStatusWrite(isError: boolean): "retry" | "submit" {
  return isError ? "retry" : "submit";
}
