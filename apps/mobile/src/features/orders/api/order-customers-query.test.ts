import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  LIST_CUSTOMERS_ACTION,
  listOrderCustomersInfiniteOptions,
  ORDER_CUSTOMERS_LOOKUP_INPUT,
} from "./order-customers-query";

describe("listOrderCustomersInfiniteOptions", () => {
  it("keys [actionName, companyId, input] for active customers and keeps cursor out of the key", () => {
    const companyA = listOrderCustomersInfiniteOptions({
      client: null,
      companyId: "company-a",
      getActiveCompany: () => "company-a",
    });
    const companyB = listOrderCustomersInfiniteOptions({
      client: null,
      companyId: "company-b",
      getActiveCompany: () => "company-b",
    });
    expect(companyA.queryKey).toEqual(
      contractQueryKey(
        LIST_CUSTOMERS_ACTION,
        "company-a",
        ORDER_CUSTOMERS_LOOKUP_INPUT,
      ),
    );
    expect(companyA.queryKey).not.toEqual(companyB.queryKey);
    expect(companyA.queryKey[1]).toBe("company-a");
    expect(JSON.stringify(companyA.queryKey)).not.toContain("cursor");
    expect(ORDER_CUSTOMERS_LOOKUP_INPUT.status).toBe("active");
    expect(companyA.enabled).toBe(false);
  });
});
