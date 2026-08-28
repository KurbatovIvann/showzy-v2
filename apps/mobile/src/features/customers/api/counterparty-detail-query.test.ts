import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  GET_COUNTERPARTY_ACTION,
  getCounterpartyQueryOptions,
} from "./counterparty-detail-query";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

describe("getCounterpartyQueryOptions", () => {
  it("keys by action, company selector, and counterparty id", () => {
    const options = getCounterpartyQueryOptions({
      client: null,
      companyId: "company-a",
      counterpartyId: COUNTERPARTY_ID,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_COUNTERPARTY_ACTION, "company-a", {
        id: COUNTERPARTY_ID,
      }),
    );
  });

  it("stays disabled without a client, company, or valid counterparty id", () => {
    expect(
      getCounterpartyQueryOptions({
        client: null,
        companyId: "company-a",
        counterpartyId: COUNTERPARTY_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getCounterpartyQueryOptions({
        client: null,
        companyId: "company-a",
        counterpartyId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
