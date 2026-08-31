/**
 * Pure view-model logic for the product detail screen (SHO-138 / SHO-152).
 * No React Native imports so the decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import { formatMoneyMinor } from "../../../../format/money";
import { interpolate, type Locale } from "../../../../i18n/locale";
import type {
  ProductsDetailCopy,
  ProductsVariantForms,
} from "../../../../i18n/products";
import type { CatalogStatusWrite } from "../api/product-archive";
import type {
  GetProductOutput,
  GetProductVariant,
} from "../api/product-detail-query";
import type { ProductQueryLoadState } from "../shared/classify-product-load";
import { variantCountLabel } from "../shared/variant-count";
import {
  IDLE_DETAIL_SHEETS,
  reduceProductDetailSheets,
  type DetailSheets,
} from "./product-detail.reducer";

export {
  IDLE_DETAIL_SHEETS,
  productDetailSheetChrome,
  reduceProductDetailSheets,
  sheetsAfterCloseVariantEditor,
  sheetsAfterProductSheetAction,
  sheetsAfterVariantSheetAction,
  sheetsOpenNewVariant,
  sheetsOpenProductActions,
  sheetsOpenVariantActions,
  type DetailSheets,
  type ProductDetailSheetAction,
} from "./product-detail.reducer";

export type ProductDetailState = ProductQueryLoadState;

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

export type ProductSheetActionId = "edit" | "photos" | "status";

export type VariantSheetActionId = "edit" | "status";

export type ProductSheetActionResult =
  | { readonly kind: "navigate-edit" }
  | { readonly kind: "focus-photos" }
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
  if (args.action === "edit") {
    return { kind: "navigate-edit" };
  }
  if (args.action === "photos") {
    return { kind: "focus-photos" };
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

export function sheetsAfterCancelStatusConfirm(args: {
  readonly target: ConfirmTarget;
  readonly variantActionId: string | null;
  readonly variantActionName?: string;
  readonly variantActionArchived?: boolean;
}): DetailSheets {
  return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
    type: "cancelStatusConfirm",
    restore:
      args.target.kind === "archive-variant" ||
      args.target.kind === "restore-variant"
        ? "variantActions"
        : "idle",
    variantActionId: args.variantActionId,
    variantActionName: args.variantActionName ?? "",
    variantActionArchived: args.variantActionArchived ?? false,
  });
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

export function resolveSelectedVariant(
  product: ProductDetailViewModel | null,
  variantActionId: string | null,
): ProductVariantView | null {
  if (product === null || variantActionId === null) {
    return null;
  }
  return (
    product.variants.find((variant) => variant.id === variantActionId) ?? null
  );
}
