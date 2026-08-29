import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  GET_CUSTOMER_ACTION,
  getCustomerNameQueryOptions,
} from "./customer-name-query";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("getCustomerNameQueryOptions", () => {
  it("keys by action, company selector, and customer id", () => {
    const options = getCustomerNameQueryOptions({
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
    expect(options.queryKey[1]).toBe("company-a");
  });

  it("stays disabled without a client, company, or customer id", () => {
    expect(
      getCustomerNameQueryOptions({
        client: null,
        companyId: "company-a",
        customerId: CUSTOMER_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getCustomerNameQueryOptions({
        client: null,
        companyId: "company-a",
        customerId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
