import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  bindGetCompany,
  GET_COMPANY_ACTION,
  GET_COMPANY_INPUT,
  getCompanyQueryOptions,
} from "./company.queries";

describe("getCompanyQueryOptions", () => {
  it("keys by action, company selector, and empty input", () => {
    const options = getCompanyQueryOptions({
      client: null,
      companyId: "company-a",
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_COMPANY_ACTION, "company-a", GET_COMPANY_INPUT),
    );
  });

  it("stays disabled without a client, company, or view permission", () => {
    expect(
      getCompanyQueryOptions({
        client: null,
        companyId: "company-a",
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getCompanyQueryOptions({
        client: null,
        companyId: null,
        getActiveCompany: () => null,
      }).enabled,
    ).toBe(false);
    expect(
      getCompanyQueryOptions({
        client: null,
        companyId: "company-a",
        getActiveCompany: () => "company-a",
        enabled: false,
      }).enabled,
    ).toBe(false);
  });
});

describe("bindGetCompany", () => {
  it("calls companies.get with empty input", async () => {
    const seen: unknown[] = [];
    const fetchCompany = bindGetCompany({
      client: {
        companies: {
          get: (input) => {
            seen.push(input);
            return Promise.resolve({
              id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
              name: "Sophie",
              slug: "sophie",
              prefix: "SP",
              legal: null,
            });
          },
        },
      },
    });

    await fetchCompany();
    expect(seen).toEqual([GET_COMPANY_INPUT]);
  });
});
