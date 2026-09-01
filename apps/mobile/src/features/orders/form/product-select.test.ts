import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../shared/item-count";
import {
  filterProductSelectRows,
  productPickerParentSubtitle,
  type ProductSelectRow,
} from "./product-select";

describe("productPickerParentSubtitle", () => {
  it("uses none / count copy until variants are selected, then count · names", () => {
    const uk = ordersCopy("uk").create;
    const en = ordersCopy("en").create;
    expect(
      productPickerParentSubtitle({
        variantCount: 0,
        selectedNames: [],
        noneLabel: uk.variantsNone,
        countLabel: itemCountLabel(2, "uk", uk.variants),
        selectedLabel: uk.variantsSelected,
      }),
    ).toBe("Без варіантів");
    expect(
      productPickerParentSubtitle({
        variantCount: 2,
        selectedNames: [],
        noneLabel: uk.variantsNone,
        countLabel: itemCountLabel(2, "uk", uk.variants),
        selectedLabel: uk.variantsSelected,
      }),
    ).toBe("2 варіанти");
    expect(
      productPickerParentSubtitle({
        variantCount: 2,
        selectedNames: ["1 кг", "Шоколад"],
        noneLabel: uk.variantsNone,
        countLabel: itemCountLabel(2, "uk", uk.variants),
        selectedLabel: uk.variantsSelected,
      }),
    ).toBe("2 вибрано · 1 кг, Шоколад");
    expect(
      productPickerParentSubtitle({
        variantCount: 2,
        selectedNames: ["1 kg", "Chocolate"],
        noneLabel: en.variantsNone,
        countLabel: itemCountLabel(2, "en", en.variants),
        selectedLabel: en.variantsSelected,
      }),
    ).toBe("2 selected · 1 kg, Chocolate");
  });
});

describe("filterProductSelectRows", () => {
  it("does not walk the catalog when the picker session is closed", () => {
    let walked = 0;
    const products = new Proxy([] as ProductSelectRow[], {
      get(target, property, receiver) {
        walked += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const filtered = filterProductSelectRows(products, "торт", false);
    expect(filtered).toEqual([]);
    expect(walked).toBe(0);
  });

  it("filters by name only while the session is open", () => {
    const products: ProductSelectRow[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Торт",
        hasVariants: false,
        variantsLabel: "Без варіантів",
        thumbnailFileId: null,
        thumbnailUrl: null,
        thumbnailFailed: false,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Кава",
        hasVariants: false,
        variantsLabel: "Без варіантів",
        thumbnailFileId: null,
        thumbnailUrl: null,
        thumbnailFailed: false,
      },
    ];
    expect(filterProductSelectRows(products, "", true)).toBe(products);
    expect(
      filterProductSelectRows(products, "тор", true).map((row) => row.id),
    ).toEqual([products[0]?.id]);
  });
});
