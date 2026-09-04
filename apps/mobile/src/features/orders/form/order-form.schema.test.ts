import { describe, expect, it } from "vitest";

import {
  CREATE_ORDER_COMMENT_MAX,
  CREATE_ORDER_MAX_ITEMS,
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  isCommentErrorKey,
  isCustomerErrorKey,
  isItemsErrorKey,
  orderFormDraftSchema,
} from "./order-form.schema";
import { emptyOrderFormDraft, type OrderFormDraft } from "./order-form-draft";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";

function validDraft(overrides: Partial<OrderFormDraft> = {}): OrderFormDraft {
  return {
    customerId: CUSTOMER_ID,
    customerName: "Марія",
    comment: "",
    nextDraftSerial: 2,
    items: [
      {
        key: "draft-1",
        productId: PRODUCT_ID,
        variantId: null,
        productName: "Торт",
        variantName: null,
        quantityMilli: "1000",
      },
    ],
    ...overrides,
  };
}

describe("orderFormDraftSchema", () => {
  it("requires a customer and at least one line", () => {
    const parsed = orderFormDraftSchema.safeParse(emptyOrderFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.customer).toBe("required");
    expect(errors.items).toBe("required");
    expect(isCustomerErrorKey("required")).toBe(true);
    expect(isItemsErrorKey("required")).toBe(true);
  });

  it("rejects duplicate product/variant lines", () => {
    const parsed = orderFormDraftSchema.safeParse(
      validDraft({
        items: [
          {
            key: "draft-1",
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
            productName: "Торт",
            variantName: "1 кг",
            quantityMilli: "1000",
          },
          {
            key: "draft-2",
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
            productName: "Торт",
            variantName: "1 кг",
            quantityMilli: "2000",
          },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(parsed.error).items).toBe("duplicate");
    expect(isItemsErrorKey("duplicate")).toBe(true);
    expect(isItemsErrorKey("variant_required")).toBe(true);
    expect(isItemsErrorKey("no_active_variants")).toBe(true);
  });

  it("allows the same product with a different variant", () => {
    expect(
      orderFormDraftSchema.safeParse(
        validDraft({
          items: [
            {
              key: "draft-1",
              productId: PRODUCT_ID,
              variantId: null,
              productName: "Торт",
              variantName: null,
              quantityMilli: "1000",
            },
            {
              key: "draft-2",
              productId: PRODUCT_ID,
              variantId: VARIANT_ID,
              productName: "Торт",
              variantName: "1 кг",
              quantityMilli: "1000",
            },
          ],
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects a comment over CREATE_ORDER_COMMENT_MAX", () => {
    const parsed = orderFormDraftSchema.safeParse(
      validDraft({ comment: "x".repeat(CREATE_ORDER_COMMENT_MAX + 1) }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(parsed.error).comment).toBe("too_long");
    expect(isCommentErrorKey("too_long")).toBe(true);
  });

  it("accepts a comment at the max and pins the create ceiling", () => {
    expect(CREATE_ORDER_COMMENT_MAX).toBe(2000);
    expect(CREATE_ORDER_MAX_ITEMS).toBe(100);
    expect(
      orderFormDraftSchema.safeParse(
        validDraft({ comment: "x".repeat(CREATE_ORDER_COMMENT_MAX) }),
      ).success,
    ).toBe(true);
    expect(emptyFieldErrors()).toEqual({
      customer: null,
      items: null,
      comment: null,
    });
  });
});
