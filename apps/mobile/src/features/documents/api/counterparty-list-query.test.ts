import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  documentCounterpartiesLookupInput,
  LIST_COUNTERPARTIES_ACTION,
  listDocumentCounterpartiesInfiniteOptions,
} from "./counterparty-list-query";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("listDocumentCounterpartiesInfiniteOptions", () => {
  it("keys [actionName, companyId, input] including customerId and stays disabled without a customer", () => {
    const scoped = listDocumentCounterpartiesInfiniteOptions({
      client: null,
      companyId: "company-a",
      customerId: CUSTOMER_ID,
      getActiveCompany: () => "company-a",
    });
    const otherCompany = listDocumentCounterpartiesInfiniteOptions({
      client: null,
      companyId: "company-b",
      customerId: CUSTOMER_ID,
      getActiveCompany: () => "company-b",
    });
    const noCustomer = listDocumentCounterpartiesInfiniteOptions({
      client: null,
      companyId: "company-a",
      customerId: null,
      getActiveCompany: () => "company-a",
    });
    expect(scoped.queryKey).toEqual(
      contractQueryKey(
        LIST_COUNTERPARTIES_ACTION,
        "company-a",
        documentCounterpartiesLookupInput(CUSTOMER_ID),
      ),
    );
    expect(scoped.queryKey[1]).toBe("company-a");
    expect(scoped.queryKey).not.toEqual(otherCompany.queryKey);
    expect(JSON.stringify(scoped.queryKey)).toContain(CUSTOMER_ID);
    expect(JSON.stringify(scoped.queryKey)).not.toContain("companyId");
    expect(scoped.enabled).toBe(false);
    expect(noCustomer.enabled).toBe(false);
  });
});
