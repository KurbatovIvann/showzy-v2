import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  LIST_COUNTERPARTIES_ACTION,
  listCounterpartiesInfiniteOptions,
} from "./counterparty.queries";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("listCounterpartiesInfiniteOptions", () => {
  it("keys the customer filter separately from the unfiltered list", () => {
    const filtered = listCounterpartiesInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { customerId: CUSTOMER_ID, limit: 50 },
      getActiveCompany: () => "company-a",
    });
    const unfiltered = listCounterpartiesInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { limit: 50 },
      getActiveCompany: () => "company-a",
    });
    expect(filtered.queryKey).toEqual(
      contractQueryKey(LIST_COUNTERPARTIES_ACTION, "company-a", {
        customerId: CUSTOMER_ID,
        limit: 50,
      }),
    );
    expect(filtered.queryKey).not.toEqual(unfiltered.queryKey);
    expect(filtered.enabled).toBe(false);
  });
});
