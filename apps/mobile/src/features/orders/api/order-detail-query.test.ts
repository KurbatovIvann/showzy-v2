import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import { GET_ORDER_ACTION, getOrderQueryOptions } from "./order-detail-query";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("getOrderQueryOptions", () => {
  it("keys [actionName, companyId, input] including the company selector", () => {
    const options = getOrderQueryOptions({
      client: null,
      companyId: "company-a",
      orderId: ORDER_ID,
      getActiveCompany: () => "company-a",
    });
    const otherCompany = getOrderQueryOptions({
      client: null,
      companyId: "company-b",
      orderId: ORDER_ID,
      getActiveCompany: () => "company-b",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_ORDER_ACTION, "company-a", { orderId: ORDER_ID }),
    );
    expect(options.queryKey[1]).toBe("company-a");
    expect(options.queryKey).not.toEqual(otherCompany.queryKey);
  });

  it("stays disabled without a client, company, or valid order id", () => {
    expect(
      getOrderQueryOptions({
        client: null,
        companyId: "company-a",
        orderId: ORDER_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getOrderQueryOptions({
        client: null,
        companyId: "company-a",
        orderId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
