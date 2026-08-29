import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../shared/item-count";
import { productPickerParentSubtitle } from "./product-select";

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
