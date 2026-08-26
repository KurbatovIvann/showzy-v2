import { describe, expect, it } from "vitest";

import { productsCopy } from "../../../../i18n/products";
import {
  confirmIsDestructive,
  confirmSheetCopy,
  confirmTargetForProduct,
  confirmTargetForVariant,
  isConfirmWriteBusy,
  mapStatusWriteFailure,
  planConfirmStatusWrite,
  productFacts,
  productHeaderSubtitle,
  productSheetActionIds,
  resultForProductSheetAction,
  resultForVariantSheetAction,
  sheetsAfterCloseVariantEditor,
  sheetsAfterCancelStatusConfirm,
  sheetsAfterProductSheetAction,
  sheetsAfterVariantSheetAction,
  sheetsOpenNewVariant,
  sheetsOpenVariantActions,
  IDLE_DETAIL_SHEETS,
  statusWriteBanner,
  statusWriteForConfirm,
  toProductDetailView,
  variantRowPriceLabel,
  variantStatusActionLabel,
} from "./product-detail-model";
import type { GetProductOutput } from "../api/product-detail-query";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const VARIANT_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "44444444-4444-4444-8444-444444444444";

function product(overrides: Partial<GetProductOutput> = {}): GetProductOutput {
  return {
    id: PRODUCT_ID,
    name: "Торт «Київський»",
    basePriceMinor: "123456",
    currency: "UAH",
    status: "active",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    variants: [],
    imageFileIds: [],
    ...overrides,
  };
}

describe("toProductDetailView", () => {
  it("maps name, base price, archived flag, and ordered image ids", () => {
    const view = toProductDetailView(
      product({
        status: "archived",
        imageFileIds: [IMAGE_ID],
      }),
    );
    expect(view).toEqual({
      id: PRODUCT_ID,
      name: "Торт «Київський»",
      priceLabel: "1\u00A0234,56\u00A0₴",
      archived: true,
      imageFileIds: [IMAGE_ID],
      variants: [],
    });
  });

  it("uses the product price when a variant has no override", () => {
    const view = toProductDetailView(
      product({
        variants: [
          {
            id: VARIANT_ID,
            name: "1 кг",
            status: "active",
            basePriceMinor: null,
            currency: null,
          },
        ],
      }),
    );
    expect(view.variants).toEqual([
      {
        id: VARIANT_ID,
        name: "1 кг",
        archived: false,
        priceLabel: "1\u00A0234,56\u00A0₴",
        priceInherited: true,
        priceMinor: null,
      },
    ]);
  });

  it("formats a variant override with its own currency fallback", () => {
    const view = toProductDetailView(
      product({
        variants: [
          {
            id: VARIANT_ID,
            name: "2 кг",
            status: "archived",
            basePriceMinor: "200000",
            currency: "UAH",
          },
        ],
      }),
    );
    expect(view.variants[0]).toEqual({
      id: VARIANT_ID,
      name: "2 кг",
      archived: true,
      priceLabel: "2\u00A0000\u00A0₴",
      priceInherited: false,
      priceMinor: "200000",
    });
  });
});

describe("confirm sheet planning", () => {
  const copy = productsCopy("uk").detail;

  it("opens archive vs restore from the current status", () => {
    expect(confirmTargetForProduct(false)).toEqual({
      kind: "archive-product",
    });
    expect(confirmTargetForProduct(true)).toEqual({
      kind: "restore-product",
    });
    expect(
      confirmTargetForVariant({
        archived: false,
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toEqual({
      kind: "archive-variant",
      variantId: VARIANT_ID,
      variantName: "1 кг",
    });
  });

  it("maps a confirm target onto the matching status-only write", () => {
    expect(
      statusWriteForConfirm({ kind: "archive-product" }, PRODUCT_ID),
    ).toEqual({ kind: "archiveProduct", productId: PRODUCT_ID });
    expect(
      statusWriteForConfirm({ kind: "restore-product" }, PRODUCT_ID),
    ).toEqual({ kind: "restoreProduct", productId: PRODUCT_ID });
    expect(
      statusWriteForConfirm(
        {
          kind: "archive-variant",
          variantId: VARIANT_ID,
          variantName: "1 кг",
        },
        PRODUCT_ID,
      ),
    ).toEqual({ kind: "archiveVariant", variantId: VARIANT_ID });
    expect(
      statusWriteForConfirm(
        {
          kind: "restore-variant",
          variantId: VARIANT_ID,
          variantName: "1 кг",
        },
        PRODUCT_ID,
      ),
    ).toEqual({ kind: "restoreVariant", variantId: VARIANT_ID });
  });

  it("pins Ukrainian confirmation copy and interpolates the variant name", () => {
    expect(confirmSheetCopy({ kind: "archive-product" }, copy)).toEqual({
      title: "Архівувати товар?",
      description:
        "Товар зникне з продажу. Статус варіантів не зміниться. Старі замовлення залишаться чинними.",
      confirmLabel: "Архівувати товар",
    });
    expect(
      confirmSheetCopy(
        {
          kind: "archive-variant",
          variantId: VARIANT_ID,
          variantName: "1 кг",
        },
        copy,
      ).description,
    ).toBe("Варіант «1 кг» зникне з продажу. Статус товару не зміниться.");
  });
});

describe("mapStatusWriteFailure", () => {
  it("keeps offline and permission distinct from a generic error", () => {
    expect(mapStatusWriteFailure(null)).toBeNull();
    expect(mapStatusWriteFailure("offline")).toBe("offline");
    expect(mapStatusWriteFailure("permission")).toBe("permission");
    expect(mapStatusWriteFailure("not_found")).toBe("error");
    expect(mapStatusWriteFailure("network")).toBe("error");
  });

  it("resolves banner copy from the failure key", () => {
    const copy = productsCopy("uk").detail;
    expect(statusWriteBanner(null, copy)).toBeNull();
    expect(statusWriteBanner("offline", copy)).toBe(copy.mutationOffline);
    expect(statusWriteBanner("permission", copy)).toBe(copy.mutationPermission);
    expect(statusWriteBanner("error", copy)).toBe(copy.mutationError);
  });
});

describe("planConfirmStatusWrite", () => {
  it("retries a failed confirm and submits a fresh one", () => {
    expect(planConfirmStatusWrite(false)).toBe("submit");
    expect(planConfirmStatusWrite(true)).toBe("retry");
  });
});

describe("isConfirmWriteBusy", () => {
  it("keeps the sheet busy through mutation and post-success invalidation", () => {
    expect(
      isConfirmWriteBusy({ mutationPending: false, writeBusy: false }),
    ).toBe(false);
    expect(
      isConfirmWriteBusy({ mutationPending: true, writeBusy: false }),
    ).toBe(true);
    expect(
      isConfirmWriteBusy({ mutationPending: false, writeBusy: true }),
    ).toBe(true);
  });
});

describe("variantStatusActionLabel", () => {
  it("puts the variant name in the spoken archive/restore label", () => {
    const copy = productsCopy("uk").detail;
    expect(
      variantStatusActionLabel({
        archived: false,
        variantName: "1 кг",
        copy,
      }),
    ).toBe("Архівувати варіант «1 кг»");
    expect(
      variantStatusActionLabel({
        archived: true,
        variantName: "1 кг",
        copy,
      }),
    ).toBe("Відновити варіант «1 кг»");
  });
});

describe("⋯ sheet and variant action destinations", () => {
  it("keeps edit on the editor route, photos on this screen, and status on confirm", () => {
    expect(productSheetActionIds()).toEqual(["edit", "photos", "status"]);
    expect(
      resultForProductSheetAction({ action: "edit", archived: false }),
    ).toEqual({ kind: "navigate-edit" });
    expect(
      resultForProductSheetAction({ action: "photos", archived: true }),
    ).toEqual({ kind: "focus-photos" });
    expect(
      resultForProductSheetAction({ action: "status", archived: false }),
    ).toEqual({
      kind: "confirm",
      target: { kind: "archive-product" },
    });
    expect(
      resultForProductSheetAction({ action: "status", archived: true }),
    ).toEqual({
      kind: "confirm",
      target: { kind: "restore-product" },
    });
  });

  it("routes variant edit to the editor and status to confirm", () => {
    expect(
      resultForVariantSheetAction({
        action: "edit",
        archived: false,
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toEqual({ kind: "editor" });
    expect(
      resultForVariantSheetAction({
        action: "status",
        archived: false,
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toEqual({
      kind: "confirm",
      target: {
        kind: "archive-variant",
        variantId: VARIANT_ID,
        variantName: "1 кг",
      },
    });
    expect(
      resultForVariantSheetAction({
        action: "status",
        archived: true,
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toEqual({
      kind: "confirm",
      target: {
        kind: "restore-variant",
        variantId: VARIANT_ID,
        variantName: "1 кг",
      },
    });
  });

  it("closes ⋯ before a native confirm and returns variant actions after a cancelled variant confirm", () => {
    expect(sheetsAfterProductSheetAction()).toEqual(IDLE_DETAIL_SHEETS);
    expect(
      sheetsAfterCancelStatusConfirm({
        target: {
          kind: "archive-variant",
          variantId: VARIANT_ID,
          variantName: "1 кг",
        },
        variantActionId: VARIANT_ID,
      }),
    ).toEqual(sheetsOpenVariantActions(VARIANT_ID));
    expect(
      sheetsAfterCancelStatusConfirm({
        target: { kind: "archive-product" },
        variantActionId: null,
      }),
    ).toEqual(IDLE_DETAIL_SHEETS);
    expect(
      sheetsAfterCloseVariantEditor(
        sheetsAfterVariantSheetAction({
          variantId: VARIANT_ID,
          result: { kind: "editor" },
        }),
      ),
    ).toEqual(sheetsOpenVariantActions(VARIANT_ID));
    expect(sheetsAfterCloseVariantEditor(sheetsOpenNewVariant())).toEqual(
      IDLE_DETAIL_SHEETS,
    );
  });

  it("marks archive confirms as danger and restore as not", () => {
    expect(confirmIsDestructive({ kind: "archive-product" })).toBe(true);
    expect(confirmIsDestructive({ kind: "restore-product" })).toBe(false);
    expect(
      confirmIsDestructive({
        kind: "archive-variant",
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toBe(true);
    expect(
      confirmIsDestructive({
        kind: "restore-variant",
        variantId: VARIANT_ID,
        variantName: "1 кг",
      }),
    ).toBe(false);
  });
});

describe("header subtitle and Основне facts", () => {
  it("joins status and price for the header and counts variants in uk", () => {
    const copy = productsCopy("uk");
    expect(
      productHeaderSubtitle({
        archived: false,
        statusActive: copy.detail.statusActive,
        statusArchived: copy.archivedBadge,
        priceLabel: "1 234,56 ₴",
      }),
    ).toBe("Активний · 1 234,56 ₴");
    expect(
      productFacts({
        archived: false,
        statusActive: copy.detail.statusActive,
        statusArchived: copy.archivedBadge,
        priceLabel: "1 234,56 ₴",
        variantCount: 2,
        locale: "uk",
        variantForms: copy.variants,
      }),
    ).toEqual({
      statusLabel: "Активний",
      statusTone: "success",
      priceLabel: "1 234,56 ₴",
      variantsLabel: "2 варіанти",
    });
    expect(
      variantRowPriceLabel({
        inherited: true,
        priceLabel: "1 234,56 ₴",
        inheritedTemplate: copy.form.variantInheritedPrice,
      }),
    ).toBe("як у товару · 1 234,56 ₴");
  });
});
