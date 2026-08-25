import { describe, expect, it } from "vitest";

import { productsCopy } from "../../../i18n/products";
import {
  classifyProductDetail,
  classifyProductGallery,
  confirmSheetCopy,
  confirmTargetForProduct,
  confirmTargetForVariant,
  galleryPageIndex,
  mapStatusWriteFailure,
  planConfirmStatusWrite,
  productIdFromParam,
  statusWriteBanner,
  statusWriteForConfirm,
  toProductDetailView,
} from "./product-detail-model";
import type { GetProductOutput } from "./product-detail-query";

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

describe("productIdFromParam", () => {
  it("accepts a UUID string and rejects empty, array-empty, and non-UUID values", () => {
    expect(productIdFromParam(PRODUCT_ID)).toBe(PRODUCT_ID);
    expect(productIdFromParam([PRODUCT_ID, "extra"])).toBe(PRODUCT_ID);
    expect(productIdFromParam(undefined)).toBeNull();
    expect(productIdFromParam("")).toBeNull();
    expect(productIdFromParam("not-a-uuid")).toBeNull();
    expect(productIdFromParam(["", PRODUCT_ID])).toBeNull();
  });
});

describe("classifyProductDetail", () => {
  const base = {
    productId: PRODUCT_ID,
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("is not-found when the route id is missing or invalid", () => {
    expect(classifyProductDetail({ ...base, productId: null })).toEqual({
      kind: "not-found",
    });
  });

  it("is an error when the client is not ready", () => {
    expect(classifyProductDetail({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the query is pending", () => {
    expect(classifyProductDetail({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline, not-found, and other failures", () => {
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready on a successful fetch", () => {
    expect(classifyProductDetail(base)).toEqual({ kind: "ready" });
  });
});

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

describe("galleryPageIndex", () => {
  it("rounds to the nearest page and clamps to the range", () => {
    expect(galleryPageIndex({ offsetX: 0, pageWidth: 100, pageCount: 3 })).toBe(
      0,
    );
    expect(
      galleryPageIndex({ offsetX: 140, pageWidth: 100, pageCount: 3 }),
    ).toBe(1);
    expect(
      galleryPageIndex({ offsetX: 280, pageWidth: 100, pageCount: 3 }),
    ).toBe(2);
    expect(
      galleryPageIndex({ offsetX: -20, pageWidth: 100, pageCount: 3 }),
    ).toBe(0);
    expect(
      galleryPageIndex({ offsetX: 900, pageWidth: 100, pageCount: 3 }),
    ).toBe(2);
    expect(galleryPageIndex({ offsetX: 50, pageWidth: 0, pageCount: 3 })).toBe(
      0,
    );
  });
});

describe("classifyProductGallery", () => {
  it("shows empty copy only when the product has no photos", () => {
    expect(
      classifyProductGallery({
        fileCount: 0,
        canFetchImages: true,
        pageWidth: 320,
      }),
    ).toBe("empty");
    expect(
      classifyProductGallery({
        fileCount: 0,
        canFetchImages: false,
        pageWidth: undefined,
      }),
    ).toBe("empty");
  });

  it("does not treat missing layout or a no-fetch role as empty", () => {
    expect(
      classifyProductGallery({
        fileCount: 2,
        canFetchImages: true,
        pageWidth: undefined,
      }),
    ).toBe("pending-layout");
    expect(
      classifyProductGallery({
        fileCount: 2,
        canFetchImages: true,
        pageWidth: 0,
      }),
    ).toBe("pending-layout");
    expect(
      classifyProductGallery({
        fileCount: 2,
        canFetchImages: false,
        pageWidth: 320,
      }),
    ).toBe("no-fetch");
    expect(
      classifyProductGallery({
        fileCount: 2,
        canFetchImages: true,
        pageWidth: 320,
      }),
    ).toBe("images");
  });
});

describe("planConfirmStatusWrite", () => {
  it("retries a failed confirm and submits a fresh one", () => {
    expect(planConfirmStatusWrite(false)).toBe("submit");
    expect(planConfirmStatusWrite(true)).toBe("retry");
  });
});
