/**
 * Visible price-entry rows for the editor (SHO-190). Search is local on
 * loaded catalog products. Variant rows stay in the draft when collapsed
 * so save cannot drop stored variant prices.
 */
import {
  filterCatalogProducts,
  type PriceListCatalogProduct,
  type PriceListVariantMeta,
} from "./price-list-form-draft";

export type PriceListFormFieldRow = {
  readonly key: string;
  readonly productId: string;
  readonly variantId: string | null;
};

export type VisiblePriceEntry = {
  readonly fieldIndex: number;
  readonly entryKey: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly kind: "product" | "variant";
  readonly name: string;
  readonly archived: boolean;
  readonly basePriceMinor: string;
  readonly variantCount: number;
  readonly expanded: boolean;
  readonly expanding: boolean;
  readonly showExpand: boolean;
};

export function catalogProductsForForm(
  items: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly basePriceMinor: string;
    readonly variantCount: number;
    readonly status: "active" | "archived";
  }>,
): PriceListCatalogProduct[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    basePriceMinor: item.basePriceMinor,
    variantCount: item.variantCount,
    archived: item.status === "archived",
  }));
}

export function storedEntriesForForm(
  items: ReadonlyArray<{
    readonly productId: string;
    readonly variantId: string | null;
    readonly priceMinor: string;
  }>,
): Array<{
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: string;
}> {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    priceMinor: item.priceMinor,
  }));
}

export function variantsFromGetProduct(
  variants: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly status: "active" | "archived";
    readonly basePriceMinor: string | null;
  }>,
): Array<{
  readonly id: string;
  readonly name: string;
  readonly basePriceMinor: string | null;
  readonly archived: boolean;
}> {
  return variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    basePriceMinor: variant.basePriceMinor,
    archived: variant.status === "archived",
  }));
}

function fieldIndexFor(
  fields: readonly PriceListFormFieldRow[],
  productId: string,
  variantId: string | null,
): number {
  return fields.findIndex(
    (field) => field.productId === productId && field.variantId === variantId,
  );
}

export function visiblePriceEntries(args: {
  readonly products: readonly PriceListCatalogProduct[];
  readonly fields: readonly PriceListFormFieldRow[];
  readonly query: string;
  readonly expandedProductIds: ReadonlySet<string>;
  readonly expandingProductIds: ReadonlySet<string>;
  readonly variantMeta: ReadonlyMap<string, PriceListVariantMeta>;
}): readonly VisiblePriceEntry[] {
  const visibleProducts = filterCatalogProducts(args.products, args.query);
  const rows: VisiblePriceEntry[] = [];
  for (const product of visibleProducts) {
    const productIndex = fieldIndexFor(args.fields, product.id, null);
    if (productIndex < 0) {
      continue;
    }
    const expanded = args.expandedProductIds.has(product.id);
    const expanding = args.expandingProductIds.has(product.id);
    rows.push({
      fieldIndex: productIndex,
      entryKey: args.fields[productIndex]?.key ?? product.id,
      productId: product.id,
      variantId: null,
      kind: "product",
      name: product.name,
      archived: product.archived,
      basePriceMinor: product.basePriceMinor,
      variantCount: product.variantCount,
      expanded,
      expanding,
      showExpand: product.variantCount > 0,
    });
    if (!expanded) {
      continue;
    }
    for (let index = 0; index < args.fields.length; index += 1) {
      const field = args.fields[index];
      if (
        field === undefined ||
        field.productId !== product.id ||
        field.variantId === null
      ) {
        continue;
      }
      const meta = args.variantMeta.get(field.variantId);
      rows.push({
        fieldIndex: index,
        entryKey: field.key,
        productId: product.id,
        variantId: field.variantId,
        kind: "variant",
        name: meta?.name ?? "",
        archived: meta?.archived ?? false,
        basePriceMinor: meta?.basePriceMinor ?? product.basePriceMinor,
        variantCount: 0,
        expanded: true,
        expanding: false,
        showExpand: false,
      });
    }
  }
  return rows;
}
