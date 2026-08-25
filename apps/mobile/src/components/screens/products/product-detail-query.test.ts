import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  GET_PRODUCT_ACTION,
  getProductQueryOptions,
} from "./product-detail-query";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("getProductQueryOptions", () => {
  it("keys by action, company selector, and productId", () => {
    const options = getProductQueryOptions({
      client: null,
      companyId: "company-a",
      productId: PRODUCT_ID,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_PRODUCT_ACTION, "company-a", {
        productId: PRODUCT_ID,
      }),
    );
  });

  it("stays disabled without a client, company, or valid product id", () => {
    expect(
      getProductQueryOptions({
        client: null,
        companyId: "company-a",
        productId: PRODUCT_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getProductQueryOptions({
        client: null,
        companyId: "company-a",
        productId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
