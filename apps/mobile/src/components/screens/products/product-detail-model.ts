/**
 * Pure view-model logic for the product detail screen (SHO-138 / SHO-152).
 * No React Native imports so the decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import { interpolate, type Locale } from "../../../i18n/locale";
import type {
  ProductsDetailCopy,
  ProductsVariantForms,
} from "../../../i18n/products";
import type { CatalogStatusWrite } from "./product-archive";
import type {
  GetProductOutput,
  GetProductVariant,
} from "./product-detail-query";
import { variantCountLabel } from "./variant-count";

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
  readonly priceMinor: string | null;
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
        priceMinor: variant.basePriceMinor,
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

export function isConfirmWriteBusy(args: {
  readonly mutationPending: boolean;
  readonly writeBusy: boolean;
}): boolean {
  return args.mutationPending || args.writeBusy;
}

export function variantStatusActionLabel(args: {
  readonly archived: boolean;
  readonly variantName: string;
  readonly copy: ProductsDetailCopy;
}): string {
  return interpolate(
    args.archived
      ? args.copy.restoreVariantNamed
      : args.copy.archiveVariantNamed,
    { name: args.variantName },
  );
}

/** Owner 2026-08-26: attach lives on create/edit, not detail. Never `/photos`. */
export function productEditorHref(productId: string): string {
  return `/products/${productId}/edit`;
}

export function productPhotoHref(productId: string): string {
  return productEditorHref(productId);
}

export type ProductSheetActionId = "edit" | "photos" | "status";

export type VariantSheetActionId = "edit" | "status";

export type ProductSheetActionResult =
  | { readonly kind: "navigate-edit" }
  | { readonly kind: "confirm"; readonly target: ConfirmTarget };

export type VariantSheetActionResult =
  | { readonly kind: "editor" }
  | { readonly kind: "confirm"; readonly target: ConfirmTarget };

export function productSheetActionIds(): readonly ProductSheetActionId[] {
  return ["edit", "photos", "status"];
}

export function resultForProductSheetAction(args: {
  readonly action: ProductSheetActionId;
  readonly archived: boolean;
}): ProductSheetActionResult {
  if (args.action === "edit" || args.action === "photos") {
    return { kind: "navigate-edit" };
  }
  return {
    kind: "confirm",
    target: confirmTargetForProduct(args.archived),
  };
}

export function resultForVariantSheetAction(args: {
  readonly action: VariantSheetActionId;
  readonly archived: boolean;
  readonly variantId: string;
  readonly variantName: string;
}): VariantSheetActionResult {
  if (args.action === "edit") {
    return { kind: "editor" };
  }
  return {
    kind: "confirm",
    target: confirmTargetForVariant({
      archived: args.archived,
      variantId: args.variantId,
      variantName: args.variantName,
    }),
  };
}

export function confirmIsDestructive(target: ConfirmTarget): boolean {
  return target.kind === "archive-product" || target.kind === "archive-variant";
}

export type DetailSheets = {
  readonly productActions: boolean;
  readonly variantActionId: string | null;
  readonly variantEditor:
    | { readonly mode: "new" }
    | { readonly mode: "edit"; readonly variantId: string }
    | null;
  readonly confirm: ConfirmTarget | null;
};

export const IDLE_DETAIL_SHEETS: DetailSheets = {
  productActions: false,
  variantActionId: null,
  variantEditor: null,
  confirm: null,
};

export function sheetsOpenProductActions(): DetailSheets {
  return { ...IDLE_DETAIL_SHEETS, productActions: true };
}

export function sheetsOpenVariantActions(variantId: string): DetailSheets {
  return { ...IDLE_DETAIL_SHEETS, variantActionId: variantId };
}

export function sheetsOpenNewVariant(): DetailSheets {
  return { ...IDLE_DETAIL_SHEETS, variantEditor: { mode: "new" } };
}

export function sheetsAfterProductSheetAction(
  result: ProductSheetActionResult,
): DetailSheets {
  if (result.kind === "navigate-edit") {
    return IDLE_DETAIL_SHEETS;
  }
  return { ...IDLE_DETAIL_SHEETS, confirm: result.target };
}

export function sheetsAfterVariantSheetAction(args: {
  readonly variantId: string;
  readonly result: VariantSheetActionResult;
}): DetailSheets {
  if (args.result.kind === "editor") {
    return {
      productActions: false,
      variantActionId: args.variantId,
      variantEditor: { mode: "edit", variantId: args.variantId },
      confirm: null,
    };
  }
  return {
    productActions: false,
    variantActionId: args.variantId,
    variantEditor: null,
    confirm: args.result.target,
  };
}

export function sheetsAfterCloseVariantEditor(
  sheets: DetailSheets,
): DetailSheets {
  const editor = sheets.variantEditor;
  if (editor !== null && editor.mode === "edit") {
    return {
      ...IDLE_DETAIL_SHEETS,
      variantActionId: editor.variantId,
    };
  }
  return IDLE_DETAIL_SHEETS;
}

export function sheetsAfterDismissConfirm(sheets: DetailSheets): DetailSheets {
  const target = sheets.confirm;
  if (
    target !== null &&
    (target.kind === "archive-variant" || target.kind === "restore-variant") &&
    sheets.variantActionId !== null
  ) {
    return {
      ...IDLE_DETAIL_SHEETS,
      variantActionId: sheets.variantActionId,
    };
  }
  return IDLE_DETAIL_SHEETS;
}

export function productHeaderSubtitle(args: {
  readonly archived: boolean;
  readonly statusActive: string;
  readonly statusArchived: string;
  readonly priceLabel: string;
}): string {
  const status = args.archived ? args.statusArchived : args.statusActive;
  return `${status} · ${args.priceLabel}`;
}

export type ProductFacts = {
  readonly statusLabel: string;
  readonly statusTone: "success" | "neutral";
  readonly priceLabel: string;
  readonly variantsLabel: string;
};

export function productFacts(args: {
  readonly archived: boolean;
  readonly statusActive: string;
  readonly statusArchived: string;
  readonly priceLabel: string;
  readonly variantCount: number;
  readonly locale: Locale;
  readonly variantForms: ProductsVariantForms;
}): ProductFacts {
  return {
    statusLabel: args.archived ? args.statusArchived : args.statusActive,
    statusTone: args.archived ? "neutral" : "success",
    priceLabel: args.priceLabel,
    variantsLabel: variantCountLabel(
      args.variantCount,
      args.locale,
      args.variantForms,
    ),
  };
}

export function variantRowPriceLabel(args: {
  readonly inherited: boolean;
  readonly priceLabel: string;
  readonly inheritedTemplate: string;
}): string {
  if (!args.inherited) {
    return args.priceLabel;
  }
  return interpolate(args.inheritedTemplate, { price: args.priceLabel });
}

export function variantRowActionsLabel(args: {
  readonly variantName: string;
  readonly template: string;
}): string {
  return interpolate(args.template, { name: args.variantName });
}
