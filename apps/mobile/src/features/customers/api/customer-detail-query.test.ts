import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  GET_CUSTOMER_ACTION,
  getCustomerQueryOptions,
} from "./customer-detail-query";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("getCustomerQueryOptions", () => {
  it("keys by action, company selector, and customer id", () => {
    const options = getCustomerQueryOptions({
      client: null,
      companyId: "company-a",
      customerId: CUSTOMER_ID,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_CUSTOMER_ACTION, "company-a", {
        id: CUSTOMER_ID,
      }),
    );
  });

  it("stays disabled without a client, company, or valid customer id", () => {
    expect(
      getCustomerQueryOptions({
        client: null,
        companyId: "company-a",
        customerId: CUSTOMER_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getCustomerQueryOptions({
        client: null,
        companyId: "company-a",
        customerId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
