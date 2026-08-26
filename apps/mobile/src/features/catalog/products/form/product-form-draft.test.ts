import { describe, expect, it } from "vitest";

import type { GetProductOutput } from "../api/product-detail-query";
import {
  addVariantRow,
  compactDraft,
  draftFromProduct,
  emptyProductFormDraft,
  isProductFormDirty,
  parseProductFormUiDraft,
  productFormFieldChanged,
  removeVariantRow,
  shouldHydrateVariantSheet,
  snapshotFromDraft,
  snapshotFromProduct,
  upsertVariantDraft,
  validateProductForm,
  type ProductFormDraft,
} from "./product-form-draft";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const VARIANT_ID = "11111111-1111-4111-8111-111111111111";

const loaded: GetProductOutput = {
  id: PRODUCT_ID,
  name: "Торт",
  basePriceMinor: "150000",
  currency: "UAH",
  status: "active",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  imageFileIds: [],
  variants: [
    {
      id: VARIANT_ID,
      name: "1 кг",
      status: "active",
      basePriceMinor: "180000",
      currency: "UAH",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "0.5 кг",
      status: "archived",
      basePriceMinor: null,
      currency: null,
    },
  ],
};

function validCreateDraft(): ProductFormDraft {
  return {
    name: "  Торт  ",
    priceText: "1 500",
    nextDraftSerial: 2,
    variants: [
      {
        key: "draft-1",
        variantId: null,
        name: "1 кг",
        priceText: "1800",
        archived: false,
      },
      {
        key: "draft-empty",
        variantId: null,
        name: "  ",
        priceText: "",
        archived: false,
      },
    ],
  };
}

describe("draftFromProduct", () => {
  it("prefills major-unit prices and keeps archived variants", () => {
    const draft = draftFromProduct(loaded);
    expect(draft.name).toBe("Торт");
    expect(draft.priceText).toBe("1500");
    expect(draft.variants).toEqual([
      {
        key: VARIANT_ID,
        variantId: VARIANT_ID,
        name: "1 кг",
        priceText: "1800",
        archived: false,
      },
      {
        key: "22222222-2222-4222-8222-222222222222",
        variantId: "22222222-2222-4222-8222-222222222222",
        name: "0.5 кг",
        priceText: "",
        archived: true,
      },
    ]);
  });
});

describe("validateProductForm", () => {
  it("requires a name and a non-negative major-unit price", () => {
    expect(validateProductForm(emptyProductFormDraft())).toEqual({
      name: "required",
      price: "required",
      variants: {},
    });
    expect(
      validateProductForm({
        ...emptyProductFormDraft(),
        name: "x".repeat(121),
        priceText: "-1",
      }),
    ).toMatchObject({ name: "too_long", price: "invalid" });
    expect(validateProductForm(validCreateDraft())).toEqual({
      name: null,
      price: null,
      variants: {},
    });
  });

  it("rejects a variant price without a name and drops blank unsaved rows", () => {
    const draft: ProductFormDraft = {
      name: "Торт",
      priceText: "10",
      nextDraftSerial: 2,
      variants: [
        {
          key: "draft-1",
          variantId: null,
          name: "",
          priceText: "5",
          archived: false,
        },
      ],
    };
    expect(validateProductForm(draft).variants["draft-1"]?.name).toBe(
      "required",
    );
    expect(compactDraft(validCreateDraft()).variants).toHaveLength(1);
  });
});

describe("addVariantRow / removeVariantRow", () => {
  it("adds a local row and only removes unsaved rows", () => {
    const added = addVariantRow(emptyProductFormDraft());
    expect(added.variants).toHaveLength(1);
    expect(added.variants[0]?.variantId).toBeNull();
    expect(
      removeVariantRow(added, added.variants[0]?.key ?? "").variants,
    ).toHaveLength(0);
    const loadedDraft = draftFromProduct(loaded);
    expect(removeVariantRow(loadedDraft, VARIANT_ID).variants).toHaveLength(2);
  });
});

describe("snapshotFromDraft", () => {
  it("prefills the same minor-unit snapshot as the loaded product", () => {
    expect(snapshotFromDraft(draftFromProduct(loaded))).toEqual(
      snapshotFromProduct(loaded),
    );
  });

  it("canonicalizes 1,00 and 1 as the same minor-unit snapshot", () => {
    const left = snapshotFromDraft({
      name: "Торт",
      priceText: "1,00",
      variants: [],
      nextDraftSerial: 1,
    });
    const right = snapshotFromDraft({
      name: "Торт",
      priceText: "1",
      variants: [],
      nextDraftSerial: 1,
    });
    expect(left?.priceMinor).toBe("100");
    expect(left?.priceMinor).toBe(right?.priceMinor);
  });
});

describe("isProductFormDirty / productFormFieldChanged", () => {
  it("is clean for an empty create draft and dirty after typing", () => {
    const origin = emptyProductFormDraft();
    expect(isProductFormDirty(origin, origin)).toBe(false);
    expect(isProductFormDirty({ ...origin, name: "Торт" }, origin)).toBe(true);
    expect(productFormFieldChanged("create", "Торт", "")).toBe(false);
  });

  it("is clean for a loaded edit draft and dirty after a variant sheet save", () => {
    const origin = draftFromProduct(loaded);
    expect(isProductFormDirty(origin, origin)).toBe(false);
    expect(isProductFormDirty({ ...origin, name: "Наполеон" }, origin)).toBe(
      true,
    );
    expect(productFormFieldChanged("edit", "Наполеон", origin.name)).toBe(true);
    const withVariant = upsertVariantDraft(origin, {
      key: null,
      name: "Міні",
      priceText: "",
    });
    expect(isProductFormDirty(withVariant, origin)).toBe(true);
  });
});

describe("shouldHydrateVariantSheet", () => {
  it("hydrates only on closed-to-open, not while the sheet stays open", () => {
    expect(shouldHydrateVariantSheet(true, false)).toBe(true);
    expect(shouldHydrateVariantSheet(true, true)).toBe(false);
    expect(shouldHydrateVariantSheet(false, true)).toBe(false);
    expect(shouldHydrateVariantSheet(true, false)).toBe(true);
  });
});

describe("parseProductFormUiDraft", () => {
  it("rejects empty parent fields with schema copy keys", () => {
    const parsed = parseProductFormUiDraft(emptyProductFormDraft());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.errors.name).toBe("required");
    expect(parsed.errors.price).toBe("required");
  });
});
