import { describe, expect, it } from "vitest";

import { CREATE_PRODUCT_MAX_VARIANTS } from "@showzy/validation/catalog";

import { productsCopy } from "../../../../i18n/products";
import {
  compactDraft,
  emptyProductFormDraft,
  resolveProductFormCopy,
  validateProductForm,
  validateVariantSheet,
} from "./product-form-model";
import {
  CREATE_PRODUCT_MAX_VARIANTS as SCHEMA_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  fieldErrorsFromDraftSchema,
  isNameErrorKey,
  isPriceErrorKey,
  productFormDraftSchema,
  productFormResolver,
  variantSheetSchema,
} from "./product-form.schema";

const copy = productsCopy("uk").form;

describe("productFormDraftSchema", () => {
  it("requires a name and a major-unit price", () => {
    const parsed = productFormDraftSchema.safeParse(emptyProductFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error, []);
    expect(errors.name).toBe("required");
    expect(errors.price).toBe("required");
    if (errors.name === null || errors.price === null) {
      return;
    }
    expect(isNameErrorKey(errors.name)).toBe(true);
    expect(isPriceErrorKey(errors.price)).toBe(true);
  });

  it("rejects a name over PRODUCT_NAME_MAX and an invalid price", () => {
    const parsed = productFormDraftSchema.safeParse({
      ...emptyProductFormDraft(),
      name: "x".repeat(PRODUCT_NAME_MAX + 1),
      priceText: "-1",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(parsed.error, []).name).toBe("too_long");
    expect(fieldErrorsFromDraftSchema(parsed.error, []).price).toBe("invalid");
  });

  it("treats an empty variant price as inherit", () => {
    const draft = {
      name: "Торт",
      priceText: "10",
      nextDraftSerial: 2,
      variants: [
        {
          key: "draft-1",
          variantId: null,
          name: "Класичний",
          priceText: "",
          archived: false,
        },
      ],
    };
    expect(productFormDraftSchema.safeParse(draft).success).toBe(true);
    expect(validateProductForm(draft)).toEqual({
      name: null,
      price: null,
      variants: {},
    });
  });

  it("accepts comma major units", () => {
    expect(
      productFormDraftSchema.safeParse({
        name: "Торт",
        priceText: "123,50",
        variants: [],
        nextDraftSerial: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects more than CREATE_PRODUCT_MAX_VARIANTS", () => {
    expect(SCHEMA_MAX_VARIANTS).toBe(CREATE_PRODUCT_MAX_VARIANTS);
    const parsed = productFormDraftSchema.safeParse({
      name: "Торт",
      priceText: "10",
      nextDraftSerial: CREATE_PRODUCT_MAX_VARIANTS + 2,
      variants: Array.from(
        { length: CREATE_PRODUCT_MAX_VARIANTS + 1 },
        (_, index) => ({
          key: `draft-${String(index + 1)}`,
          variantId: null,
          name: `V${String(index + 1)}`,
          priceText: "",
          archived: false,
        }),
      ),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("productFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await productFormResolver(
      {
        name: "",
        priceText: "",
        variants: [],
        nextDraftSerial: 1,
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    const nameKey = result.errors.name?.message;
    const priceKey = result.errors.priceText?.message;
    expect(nameKey).toBe("required");
    expect(priceKey).toBe("required");
    expect(nameKey).not.toBe(copy.errors.nameRequired);
    expect(priceKey).not.toBe(copy.errors.priceRequired);
    if (
      nameKey === undefined ||
      priceKey === undefined ||
      !isNameErrorKey(nameKey) ||
      !isPriceErrorKey(priceKey)
    ) {
      return;
    }
    const resolved = resolveProductFormCopy(copy, {
      mode: "create",
      nameError: nameKey,
      priceError: priceKey,
      variantErrors: {},
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(resolved.nameError).toBe(copy.errors.nameRequired);
    expect(resolved.priceError).toBe(copy.errors.priceRequired);
  });
});

describe("variantSheetSchema", () => {
  it("requires a custom price only when the switch is on", () => {
    expect(
      variantSheetSchema.safeParse({
        name: "Ваніль",
        customPrice: false,
        priceText: "",
      }).success,
    ).toBe(true);
    expect(
      validateVariantSheet({
        name: "",
        customPrice: true,
        priceText: "",
      }),
    ).toEqual({ name: "required", price: "required" });
  });
});

describe("compactDraft still drops blank unsaved rows before save", () => {
  it("does not keep an unnamed empty-price draft row", () => {
    expect(
      compactDraft({
        name: "Торт",
        priceText: "10",
        nextDraftSerial: 2,
        variants: [
          {
            key: "draft-1",
            variantId: null,
            name: "  ",
            priceText: "",
            archived: false,
          },
        ],
      }).variants,
    ).toHaveLength(0);
  });
});
