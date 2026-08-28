import { describe, expect, it } from "vitest";

import {
  priceListCreateHref,
  priceListEditorHref,
  priceListsHref,
} from "./price-list-hrefs";

const PRICE_LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("price-list hrefs", () => {
  it("keeps list/create/edit under /price-lists", () => {
    expect(priceListsHref()).toBe("/price-lists");
    expect(priceListCreateHref()).toBe("/price-lists/new");
    expect(priceListEditorHref(PRICE_LIST_ID)).toBe(
      `/price-lists/${PRICE_LIST_ID}/edit`,
    );
  });
});
