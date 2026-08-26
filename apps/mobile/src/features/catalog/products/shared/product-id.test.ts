import { describe, expect, it } from "vitest";

import { productIdFromParam } from "./product-id";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

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
