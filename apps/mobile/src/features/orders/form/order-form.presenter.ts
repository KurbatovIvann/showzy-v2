/**
 * Memoized order-form derivation (SHO-305). Items, picker rows, and
 * products-value copy stay out of the composer so a comment keystroke
 * does not rebuild the catalog sheet model.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import { interpolate, type Locale } from "../../../i18n/locale";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../shared/item-count";
import {
  EMPTY_ORDER_THUMBNAIL,
  type OrderThumbnailView,
} from "../shared/order-thumbnails";
import {
  fieldErrorsFromFormState,
  mapOrderFormFailure,
  resolveOrderFormCopy,
  rhfItemsMessage,
  type BannerKey,
} from "./order-form-copy";
import type {
  OrderFormFieldErrors,
  OrderFormLineDraft,
} from "./order-form-draft";
import type { ProductPickerPick, ProductPickerState } from "./product-picker";
import {
  productPickerParentSelectedNames,
  productPickerParentSubtitle,
  type ProductSelectLevel,
  type ProductSelectRow,
  type ProductSelectVariantRow,
} from "./product-select";

export type OrderFormProductLookupRow = {
  readonly id: string;
  readonly name: string;
  readonly variantCount: number;
};

export type OrderFormVariantLookupRow = {
  readonly id: string;
  readonly name: string;
};

export function presentOrderFormItems(
  fields: ReadonlyArray<{
    readonly key: string;
    readonly productId: string;
    readonly variantId: string | null;
    readonly productName: string;
    readonly variantName: string | null;
    readonly quantityMilli: string;
  }>,
): OrderFormLineDraft[] {
  return fields.map((field) => ({
    key: field.key,
    productId: field.productId,
    variantId: field.variantId,
    productName: field.productName,
    variantName: field.variantName,
    quantityMilli: field.quantityMilli,
  }));
}

export function presentProductSelectRows(args: {
  readonly productRows: readonly OrderFormProductLookupRow[];
  readonly thumbnailsByProductId: ReadonlyMap<string, OrderThumbnailView>;
  readonly picks: readonly ProductPickerPick[];
  readonly formCopy: OrdersCreateCopy;
  readonly locale: Locale;
}): readonly ProductSelectRow[] {
  return args.productRows.map((row) => {
    const thumbnail =
      args.thumbnailsByProductId.get(row.id) ?? EMPTY_ORDER_THUMBNAIL;
    const selectedNames = productPickerParentSelectedNames(args.picks, row.id);
    return {
      id: row.id,
      name: row.name,
      hasVariants: row.variantCount > 0,
      variantsLabel: productPickerParentSubtitle({
        variantCount: row.variantCount,
        selectedNames,
        noneLabel: args.formCopy.variantsNone,
        countLabel: itemCountLabel(
          row.variantCount,
          args.locale,
          args.formCopy.variants,
        ),
        selectedLabel: args.formCopy.variantsSelected,
      }),
      thumbnailFileId: thumbnail.fileId,
      thumbnailUrl: thumbnail.url,
      thumbnailFailed: thumbnail.failed,
    };
  });
}

export function presentVariantSelectRows(
  options: readonly OrderFormVariantLookupRow[],
): readonly ProductSelectVariantRow[] {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
  }));
}

export function presentProductsValue(
  itemCount: number,
  addProductsValue: string,
): string | undefined {
  if (itemCount === 0) {
    return undefined;
  }
  return interpolate(addProductsValue, {
    count: String(itemCount),
  });
}

export function presentProductPickerLevel(
  picker: ProductPickerState,
): ProductSelectLevel {
  return picker.kind === "variants" ? "variants" : "products";
}

export function presentProductPickerVariantsTitle(
  picker: ProductPickerState,
): string {
  return picker.kind === "variants" ? picker.productName : "";
}

export function presentOrderFormCopy(args: {
  readonly formCopy: OrdersCreateCopy;
  readonly submitted: boolean;
  readonly customerMessage: unknown;
  readonly itemsError: unknown;
  readonly commentMessage: unknown;
  readonly serverFields: OrderFormFieldErrors | null;
  readonly localBanner: BannerKey | null;
  readonly failureKind: QueryFailureKind | null;
  readonly wireCode: WireErrorCode | null;
  readonly pending: boolean;
  readonly clientReady: boolean;
  readonly canCreate: boolean;
}): ReturnType<typeof resolveOrderFormCopy> {
  const fieldErrors = fieldErrorsFromFormState({
    submitted: args.submitted,
    customerMessage: args.customerMessage,
    itemsMessage: rhfItemsMessage(args.itemsError),
    commentMessage: args.commentMessage,
    server: args.serverFields,
  });
  return resolveOrderFormCopy(args.formCopy, {
    customerError: fieldErrors.customer,
    itemsError: fieldErrors.items,
    commentError: fieldErrors.comment,
    banner:
      args.localBanner ?? mapOrderFormFailure(args.failureKind, args.wireCode),
    pending: args.pending,
    clientReady: args.clientReady,
    canCreate: args.canCreate,
  });
}
