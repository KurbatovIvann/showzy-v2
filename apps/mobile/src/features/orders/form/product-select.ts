/**
 * Product picker row view-model (SHO-242 / SHO-249). Kept out of the
 * sheet so the form hook does not import JSX.
 */
import { interpolate } from "../../../i18n/locale";
import type { ProductPickerPick } from "./product-picker";
import { productPickerSelectedVariantNames } from "./product-picker";

export type ProductSelectRow = {
  readonly id: string;
  readonly name: string;
  readonly hasVariants: boolean;
  readonly variantsLabel: string;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
};

export type ProductSelectVariantRow = {
  readonly id: string;
  readonly name: string;
};

export type ProductVariantsLoadStatus = "idle" | "loading" | "ready" | "error";

/**
 * Parent-row subtitle: variant count until the session has picks for
 * this product, then selected count · names (uk/en templates).
 */
export function productPickerParentSubtitle(args: {
  readonly variantCount: number;
  readonly selectedNames: readonly string[];
  readonly noneLabel: string;
  readonly countLabel: string;
  readonly selectedLabel: string;
}): string {
  if (args.variantCount === 0) {
    return args.noneLabel;
  }
  if (args.selectedNames.length === 0) {
    return args.countLabel;
  }
  return interpolate(args.selectedLabel, {
    count: String(args.selectedNames.length),
    names: args.selectedNames.join(", "),
  });
}

export function productPickerParentSelectedNames(
  picks: readonly ProductPickerPick[],
  productId: string,
): readonly string[] {
  return productPickerSelectedVariantNames(picks, productId);
}
