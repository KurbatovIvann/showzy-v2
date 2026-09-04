import { describe, expect, it } from "vitest";

import { emptyOrderFormDraft, type OrderFormDraft } from "./order-form-draft";
import {
  createOrderPayload,
  nextLastWrite,
  parseThenPlanOrderFormSave,
  planOrderFormSave,
  validateOrderFormCatalog,
  type OrderFormWrite,
  type OrderLineCatalogFactsMap,
} from "./order-form-plan";
import type { OrderLineCatalogFacts } from "./order-line-catalog-facts";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";
const ARCHIVED_VARIANT_ID = "55555555-5555-4555-8555-555555555555";

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
        quantityMilli: "2000",
      },
    ],
    ...overrides,
  };
}

function factsMap(
  entries: ReadonlyArray<readonly [string, OrderLineCatalogFacts]>,
): OrderLineCatalogFactsMap {
  return new Map(entries);
}

const SIMPLE_FACTS = factsMap([[PRODUCT_ID, { variantRows: [] }]]);

const VARIABLE_FACTS = factsMap([
  [
    PRODUCT_ID,
    {
      variantRows: [
        { id: VARIANT_ID, status: "active" },
        { id: ARCHIVED_VARIANT_ID, status: "archived" },
      ],
    },
  ],
]);

const ARCHIVED_ONLY_FACTS = factsMap([
  [
    PRODUCT_ID,
    { variantRows: [{ id: ARCHIVED_VARIANT_ID, status: "archived" }] },
  ],
]);

function planArgs(
  draft: OrderFormDraft,
  catalogFacts: OrderLineCatalogFactsMap = SIMPLE_FACTS,
): Parameters<typeof planOrderFormSave>[0] {
  return {
    draft,
    catalogFacts,
    lastWrite: null,
    lastFailureKind: null,
  };
}

describe("createOrderPayload", () => {
  it("emits wire { customer: { by: id }, items } only — no prices, payment, or delivery", () => {
    const payload = createOrderPayload(validDraft());
    expect(payload).toEqual({
      customer: { by: "id", id: CUSTOMER_ID },
      items: [
        {
          product: { by: "id", id: PRODUCT_ID },
          variantSelection: { kind: "base" },
          quantity: { milli: "2000" },
        },
      ],
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(["customer", "items"]);
    expect(Object.keys(payload?.items[0] ?? {}).sort()).toEqual([
      "product",
      "quantity",
      "variantSelection",
    ]);
    expect(payload?.items[0]).not.toHaveProperty("variant");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("basePrice");
    expect(serialized).not.toContain("unitPrice");
    expect(serialized).not.toContain("payment");
    expect(serialized).not.toContain("delivery");
    expect(serialized).not.toContain("dueDate");
    expect(serialized).not.toContain("status");
    expect(serialized).not.toContain("discount");
    expect(serialized).not.toContain("customerName");
    expect(serialized).not.toContain("productName");
    expect(serialized).not.toContain("customerId");
    expect(serialized).not.toContain("productId");
    expect(serialized).not.toContain("quantityMilli");
  });

  it("sends variantSelection.reference by id (not legacy variant) and trims comment", () => {
    const withVariant = createOrderPayload(
      validDraft({
        comment: "  Без горіхів  ",
        items: [
          {
            key: "draft-1",
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
            productName: "Торт",
            variantName: "1 кг",
            quantityMilli: "1000",
          },
        ],
      }),
    );
    expect(withVariant).toEqual({
      customer: { by: "id", id: CUSTOMER_ID },
      items: [
        {
          product: { by: "id", id: PRODUCT_ID },
          variantSelection: {
            kind: "reference",
            ref: { by: "id", id: VARIANT_ID },
          },
          quantity: { milli: "1000" },
        },
      ],
      comment: "Без горіхів",
    });
    expect(Object.keys(withVariant ?? {}).sort()).toEqual([
      "comment",
      "customer",
      "items",
    ]);
    expect(Object.keys(withVariant?.items[0] ?? {}).sort()).toEqual([
      "product",
      "quantity",
      "variantSelection",
    ]);
    expect(withVariant?.items[0]).not.toHaveProperty("variant");
    expect(createOrderPayload(validDraft({ comment: "   " }))).toEqual({
      customer: { by: "id", id: CUSTOMER_ID },
      items: [
        {
          product: { by: "id", id: PRODUCT_ID },
          variantSelection: { kind: "base" },
          quantity: { milli: "2000" },
        },
      ],
    });
  });
});

describe("planOrderFormSave", () => {
  it("submits a zero-variant simple product as variantSelection.base without a picker id", () => {
    const first = planOrderFormSave(planArgs(validDraft()));
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createOrder");
    expect(first.write.input.items[0]?.variantSelection).toEqual({
      kind: "base",
    });
    expect(first.write.input.items[0]).not.toHaveProperty("variant");
    expect(
      planOrderFormSave({
        ...planArgs(validDraft()),
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("requires an active variant id before create when the product has variant rows", () => {
    const planned = planOrderFormSave(planArgs(validDraft(), VARIABLE_FACTS));
    expect(planned).toEqual({
      kind: "invalid",
      errors: {
        customer: null,
        items: "variant_required",
        comment: null,
      },
    });
  });

  it("rejects archived-only variable products as a base line", () => {
    const planned = planOrderFormSave(
      planArgs(validDraft(), ARCHIVED_ONLY_FACTS),
    );
    expect(planned).toEqual({
      kind: "invalid",
      errors: {
        customer: null,
        items: "no_active_variants",
        comment: null,
      },
    });
    expect(
      createOrderPayload(validDraft())?.items[0]?.variantSelection,
    ).toEqual({ kind: "base" });
  });

  it("sends variantSelection.reference for an active variant id", () => {
    const planned = planOrderFormSave(
      planArgs(
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
          ],
        }),
        VARIABLE_FACTS,
      ),
    );
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write") {
      return;
    }
    expect(planned.write.input.items[0]?.variantSelection).toEqual({
      kind: "reference",
      ref: { by: "id", id: VARIANT_ID },
    });
    expect(planned.write.input.items[0]).not.toHaveProperty("variant");
  });

  it("maps a stale archived variant id back to the variant field", () => {
    const planned = planOrderFormSave(
      planArgs(
        validDraft({
          items: [
            {
              key: "draft-1",
              productId: PRODUCT_ID,
              variantId: ARCHIVED_VARIANT_ID,
              productName: "Торт",
              variantName: "Old",
              quantityMilli: "1000",
            },
          ],
        }),
        VARIABLE_FACTS,
      ),
    );
    expect(planned).toEqual({
      kind: "invalid",
      errors: {
        customer: null,
        items: "variant_required",
        comment: null,
      },
    });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planOrderFormSave(planArgs(emptyOrderFormDraft(), new Map())).kind,
    ).toBe("invalid");
    expect(
      parseThenPlanOrderFormSave(planArgs(emptyOrderFormDraft(), new Map()))
        .kind,
    ).toBe("invalid");
  });

  it("does not retry a different payload", () => {
    const lastWrite: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customer: { by: "id", id: CUSTOMER_ID },
        items: [
          {
            product: { by: "id", id: PRODUCT_ID },
            quantity: { milli: "1000" },
            variantSelection: { kind: "base" },
          },
        ],
      },
    };
    const planned = planOrderFormSave({
      ...planArgs(validDraft()),
      lastWrite,
      lastFailureKind: "network",
    });
    expect(planned.kind).toBe("write");
  });

  it("retries after an intervening edit that restores the same wire payload", () => {
    const first = planOrderFormSave(planArgs(validDraft()));
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    const recorded = nextLastWrite(first, null);
    expect(
      planOrderFormSave({
        ...planArgs(validDraft({ comment: "Упакувати окремо" })),
        lastWrite: recorded,
        lastFailureKind: "network",
      }).kind,
    ).toBe("write");
    expect(
      planOrderFormSave({
        ...planArgs(validDraft({ comment: "" })),
        lastWrite: recorded,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
    expect(
      planOrderFormSave({
        ...planArgs(validDraft({ comment: "  " })),
        lastWrite: recorded,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("does not retry when lastWrite matches but the retryable-failure signal was dropped", () => {
    const first = planOrderFormSave(planArgs(validDraft()));
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(
      planOrderFormSave({
        ...planArgs(validDraft()),
        lastWrite: nextLastWrite(first, null),
        lastFailureKind: null,
      }).kind,
    ).toBe("write");
  });

  it("does not plan variant_required or a write when catalog facts are missing", () => {
    const planned = planOrderFormSave(planArgs(validDraft(), new Map()));
    expect(planned.kind).not.toBe("write");
    expect(planned.kind).not.toBe("retry");
    expect(planned).toEqual({
      kind: "invalid",
      errors: {
        customer: null,
        items: null,
        comment: null,
      },
    });
    expect(validateOrderFormCatalog(validDraft(), new Map()).items).not.toBe(
      "variant_required",
    );
    expect(validateOrderFormCatalog(validDraft(), new Map()).items).toBeNull();
  });
});
