import { describe, expect, it } from "vitest";

import { priceListIdFromParam } from "./price-list-id";

const PRICE_LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("priceListIdFromParam", () => {
  it("accepts a UUID and refuses anything else", () => {
    expect(priceListIdFromParam(PRICE_LIST_ID)).toBe(PRICE_LIST_ID);
    expect(priceListIdFromParam([PRICE_LIST_ID])).toBe(PRICE_LIST_ID);
    expect(priceListIdFromParam(undefined)).toBeNull();
    expect(priceListIdFromParam("")).toBeNull();
    expect(priceListIdFromParam("not-a-uuid")).toBeNull();
  });
});
