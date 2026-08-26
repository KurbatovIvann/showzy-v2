import { describe, expect, it } from "vitest";

import { productEditorHref, productPhotoHref } from "./product-hrefs";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("product hrefs", () => {
  it("keeps photos on the product, never /photos", () => {
    expect(productEditorHref(PRODUCT_ID)).toBe(`/products/${PRODUCT_ID}/edit`);
    expect(productPhotoHref(PRODUCT_ID)).toBe(`/products/${PRODUCT_ID}`);
    expect(productPhotoHref(PRODUCT_ID)).not.toContain("/photos");
  });
});
