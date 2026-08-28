import { describe, expect, it } from "vitest";

import { pricingCopy } from "../../../i18n/pricing";
import {
  emptyPriceListFormDraft,
  parsePriceListFormUiDraft,
  validatePriceListForm,
} from "./price-list-form-draft";
import { resolvePriceListFormCopy } from "./price-list-form-copy";
import {
  PRICE_LIST_NAME_MAX,
  fieldErrorsFromDraftSchema,
  isNameErrorKey,
  isPriceErrorKey,
  priceListFormDraftSchema,
  priceListFormResolver,
} from "./price-list-form.schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const copy = pricingCopy("uk").form;

function validDraft() {
  return {
    ...emptyPriceListFormDraft(),
    name: "Опт",
  };
}

describe("priceListFormDraftSchema", () => {
  it("requires a name and caps it at PRICE_LIST_NAME_MAX", () => {
    const empty = priceListFormDraftSchema.safeParse(emptyPriceListFormDraft());
    expect(empty.success).toBe(false);
    if (empty.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(empty.error, []).name).toBe("required");
    expect(isNameErrorKey("required")).toBe(true);

    const tooLong = priceListFormDraftSchema.safeParse({
      ...validDraft(),
      name: "x".repeat(PRICE_LIST_NAME_MAX + 1),
    });
    expect(tooLong.success).toBe(false);
    if (tooLong.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(tooLong.error, []).name).toBe("too_long");
    expect(
      priceListFormDraftSchema.safeParse({
        ...validDraft(),
        name: "x".repeat(PRICE_LIST_NAME_MAX),
      }).success,
    ).toBe(true);
  });

  it("treats an empty price as inherit and stored 0 as a real price", () => {
    const emptyPrice = {
      ...validDraft(),
      entries: [
        {
          key: PRODUCT_ID,
          productId: PRODUCT_ID,
          variantId: null,
          priceText: "",
        },
      ],
    };
    const zeroPrice = {
      ...validDraft(),
      entries: [
        {
          key: PRODUCT_ID,
          productId: PRODUCT_ID,
          variantId: null,
          priceText: "0",
        },
      ],
    };
    expect(priceListFormDraftSchema.safeParse(emptyPrice).success).toBe(true);
    expect(priceListFormDraftSchema.safeParse(zeroPrice).success).toBe(true);
    expect(validatePriceListForm(emptyPrice)).toEqual({
      name: null,
      entries: {},
    });
    expect(parsePriceListFormUiDraft(zeroPrice).ok).toBe(true);
  });

  it("rejects a negative or non-numeric price without treating empty as invalid", () => {
    const invalid = priceListFormDraftSchema.safeParse({
      ...validDraft(),
      entries: [
        {
          key: PRODUCT_ID,
          productId: PRODUCT_ID,
          variantId: null,
          priceText: "-1",
        },
      ],
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(invalid.error, [
      { key: PRODUCT_ID },
    ]);
    expect(errors.entries[PRODUCT_ID]).toBe("invalid");
    expect(isPriceErrorKey("invalid")).toBe(true);
  });

  it("exposes a resolver and maps name errors to canvas copy", () => {
    expect(typeof priceListFormResolver).toBe("function");
    const resolved = resolvePriceListFormCopy(copy, {
      mode: "create",
      nameError: "required",
      hasPriceError: false,
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(resolved.nameError).toBe("Вкажіть назву прайс-листа");
    expect(resolved.submitLabel).toBe("Створити");
  });
});
